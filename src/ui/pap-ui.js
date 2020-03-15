import './style.scss';
import {loadPAP} from '../fa-pap-xml/pap.js';
import Lohnsteuer2020 from '../codes/Lohnsteuer2020.xml.xhtml';
import 'stringify-entities';

const traceTypes = {'assign': true, 'ifExpr': true};

export class PAPView {
	constructor() {
		let tableCss = {className: 'table'};
		let buttons = el('div', {className: 'buttons'},
			el('input', {type: 'submit', value: 'Speichern & Berechnen', onclick: this.calculate.bind(this)}),
			el('button', {onclick: this.reset.bind(this)}, textEl('span', 'Löschen & Zurücksetzen'))
		);
		this.inputContainerEl = el('div', tableCss);
		this.outputContainerEl = el('div', tableCss);
		this.errCssClass = 'error-hint';
		this.errEl = el('pre', {className: this.errCssClass});
		this.traceEl = el('div', {className: 'table trace-table'});
		this.papNameEl = el('output', {});
		this.form = el('form', {onsubmit: _ => false},
			el('div', tableCss,
				el('div', {},
					el('label', {'for': 'papfile'}, textEl('span', 'PAP-XML-Datei')),
					el('input', {type: 'file', name: 'papfile', onchange: this.onPAPChanged.bind(this)}),
					el('a', {href: '#pseudocode', onclick: this.showPseudoCode.bind(this)}, this.papNameEl),
					el('div', {}, 
						textEl('span', '| '),
						el('a', {href: 'https://www.bmf-steuerrechner.de/interface/pseudocodes.xhtml', target: 'blank'}, textEl('span', 'Vom Finanzamt bereitgestellte PAP-XML-Dateien'))
					),
				)
			),
			textEl('h2', 'Eingabe'),
			this.inputContainerEl,
			buttons,
			textEl('h2', 'Ausgabe'),
			this.outputContainerEl,
			textEl('h2', 'Rechenweg'),
			this.traceEl
		);
		let pap = this.loadPAP(Lohnsteuer2020);
		this.dom = el('div', {},
			this.errEl,
			this.form
		);
	}
	onPAPChanged(evt) {
		let files = evt.target.files;
		if (files.length === 0) {
			return
		}
		let reader = new FileReader();
		reader.onload = e => {
			try {
				this.loadPAP(e.target.result);
			} catch(e) {
				this.err(e);
				throw e;
			}
		};
		reader.readAsBinaryString(files[0]);
	}
	loadPAP(papXmlStr) {
		this.err('');
		try {
			let pap = loadPAP(papXmlStr);
			let state = {
				pap: pap,
				defaults: pap.defaults(),
				inputs: pap.inputs(),
				outputs: pap.outputs(),
			};
			this.state = state;
		} catch(e) {
			this.err(e.toString());
			throw e;
		}
		this.papNameEl.value = this.state.pap.name;
		this.populateFields('input');
		this.applyDefaults();
		this.populateFields('output');
		this.loadInputState();
		return this.state.pap;
	}
	err(msg) {
		this.errEl.className = this.errCssClass + (msg ? ' active' : '');
		this.errEl.innerHTML = msg;
	}
	reset() {
		this.err('');
		this.traceEl.innerHTML = '';
		this.clearInputState();
	}
	showPseudoCode() {
		let papName = this.state.pap.name;
		let popup = window.open('', papName, 'width=600,height=400');
		let docEl = popup.document.documentElement;
		docEl.innerHTML = '';
		docEl.appendChild(el('head', {}, textEl('title', 'Pseudocode ' + papName)));
		docEl.appendChild(el('body', {}, textEl('pre', this.state.pap.expr.toString())));
		popup.focus();
		return false;
	}
	calculate() {
		this.err('');
		this.traceEl.innerHTML = '';
		this.saveInputState();
		let calculated = false;
		try {
			let output = this.state.pap.evaluate(this.state.inputs.createValues(this.inputValues()));
			for (let out of this.state.outputs.vars) {
				this.form.elements[out.name].value = '' + output[out.name];
			}
			calculated = true;
			this.populateTrace(this.state.pap.trace, 0);
		} catch(e) {
			this.err(e.toString());
			if (!calculated) {
				this.populateTrace(this.state.pap.trace, 0);
			}
			throw e;
		}
	}
	populateTrace(trace, depth) {
		for (let e of trace) {
			let newDepth = depth;
			if (traceTypes[e.type]) {
				this.traceEl.appendChild(traceEl(e, depth));
				newDepth++;
			}
			this.populateTrace(e.evaluatedChildren, newDepth);
		}
	}
	populateFields(type) {
		let containerEl = this[type + 'ContainerEl'];
		containerEl.innerHTML = '';
		for (let varDecl of this.state[type + 's'].vars) {
			containerEl.appendChild(formField(varDecl, type));
		}
	}
	applyDefaults() {
		for (let input of this.state.inputs.vars) {
			let defVal = this.state.defaults[input.name];
			let valStr = defVal === undefined || defVal === null ? '' : '' + defVal;
			this.form.elements[input.name].value = valStr;
		}
	}
	saveInputState() {
		if (typeof(Storage) !== 'undefined') {
			for (let input of this.state.inputs.vars) {
				localStorage.setItem(input.name, this.form.elements[input.name].value);
			}
		} else {
			console.log('WARN: localStorage is unsupported');
		}
	}
	loadInputState() {
		if (typeof(Storage) !== 'undefined') {
			for (let input of this.state.inputs.vars) {
				let value = localStorage.getItem(input.name);
				if (value !== null && value !== '') {
					this.form.elements[input.name].value = value;
				}
			}
		} else {
			console.log('WARN: localStorage is unsupported');
		}
	}
	clearInputState() {
		if (typeof(Storage) !== 'undefined') {
			localStorage.clear();
		} else {
			console.log('WARN: localStorage is unsupported');
		}
		this.applyDefaults();
	}
	inputValues() {
		let values = {};
		for (let input of this.state.inputs.vars) {
			values[input.name] = this.form.elements[input.name].value;
		}
		return values;
	}
}

function traceEl(item, depth) {
	let addClassName = '';
	let exprStr = '';
	let valStr = '= ' + item.value;
	let debugItem = item;
	if (item.type === 'ifExpr' && item.condition) {
		debugItem = item.condition;
		let leafExpr = item.evaluatedChildren.length === 0;
		if (leafExpr) {
			addClassName = ' inactive-leaf';
		}
		if (item.condition.value === true || leafExpr) {
			exprStr = `if ${item.condition.expr}:`;
		} else {
			exprStr = `if !(${item.condition.expr}):`;
		}
		valStr = '';
	} else {
		exprStr = item.expr.toString();
	}
	return el('div', {className: 'trace-row' + addClassName},
		el('div', {className: 'trace-expr'},
			textEl('pre', ' '.repeat(depth*4) + exprStr),
			textEl('pre', collectTrace(debugItem.evaluatedChildren, 0, []).join('\n')),
		),
		textEl('span', valStr)
	);
}

function collectTrace(trace, depth, result) {
	for (let e of trace) {
		//let v = typeof e['value'] === 'function' ? 'function() {...}' : '' + e['value']; // TODO: find out why this causes a function invokation when enabled!
		//let s = (e.value === null || e.value === undefined ? '' + e.value : e.value.toString()).replace(/(\r\n|\r|\n).*$/g, '...');
		if (typeof e.value !== 'function') {
			result.push(`${e.expr}: ${e.value}`)
		}
		collectTrace(e.evaluatedChildren, depth+1, result)
	}
	return result;
}

function formField(varDecl, fieldTagName) {
	return el('div', {},
		el('label', {'for': varDecl.name}, textEl('span', varDecl.name)),
		el(fieldTagName, {name: varDecl.name}),
		textEl('pre', varDecl.comment || ''),
	);
}

function el(tagName, attrs, ...children) {
	let n = document.createElement(tagName);
	for (let [k,v] of Object.entries(attrs)) {
		n[k] = v;
	}
	for (let child of children) {
		n.appendChild(child);
	}
	return n;
}

function textEl(tagName, txt) {
	return el(tagName, {}, document.createTextNode(txt));
}
