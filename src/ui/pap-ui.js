import './style.scss';
import {load} from '../fa-pap-xml/pap.js';
import Lohnsteuer2020 from '../codes/Lohnsteuer2020.xml.xhtml';
import 'stringify-entities';

export class PAPView {
	constructor(parentEl) {
		let tableCss = {className: 'table'};
		let calcButton = el('input', {type: 'submit', value: 'Berechnen', onclick: this.calculate.bind(this)});
		this.inputContainerEl = el('div', tableCss);
		this.outputContainerEl = el('div', tableCss);
		this.codeEl = el('pre', {});
		this.errCssClass = 'error-hint';
		this.errEl = el('pre', {className: this.errCssClass});
		this.form = el('form', {onsubmit: _ => false},
			el('div', tableCss,
				el('div', {},
					el('label', {'for': 'papfile'}, textEl('span', 'PAP-XML-Datei')),
					el('input', {type: 'file', name: 'papfile', onchange: this.onPAPChanged.bind(this)}),
					el('div', {}, el('a', {href: 'https://www.bmf-steuerrechner.de/interface/pseudocodes.xhtml'}, textEl('span', 'Vom Finanzamt bereitgestellte PAP-XML-Dateien'))),
				)
			),
			textEl('h2', 'Eingabe'),
			this.inputContainerEl,
			calcButton,
			textEl('h2', 'Ausgabe'),
			this.outputContainerEl,
		);
		let pap = this.loadPAP(Lohnsteuer2020);
		parentEl.appendChild(el('div', {},
			el('a', {className: 'github-link', href: 'https://github.com/mgoltzsche/fa-xml-interpreter'}, textEl('span', 'on GitHub')),
			textEl('h1', 'PAP XML Interpreter'),
			textEl('p', `Mit dieser JavaScript-App können vom Finanzamt bereitgestellte PAP-XML-Dateien interaktiv verarbeitet werden. 
				Neben der eingebauten ${pap.name} können auch andere PAP-Dateien geladen werden.`),
			textEl('p', 'Dies ist keine offizielle App und der Autor übernimmt keine Haftung für die Richtigkeit der Angaben und Berechnungen.'),
			textEl('p', 'Benutzereingaben werden von dieser App nicht an andere Server geschickt, da die Verarbeitung im Browser stattfindet.'),
			this.errEl,
			this.form,
			textEl('h2', 'Pseudocode'),
			this.codeEl
		));
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
	loadPAP(papStr) {
		this.err('');
		try {
			let pap = load(papStr);
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
		this.populateFields('input');
		this.applyDefaults();
		this.populateFields('output');
		this.populatePAPCode();
		return this.state.pap;
	}
	err(msg) {
		this.errEl.className = this.errCssClass + (msg ? ' active' : '');
		this.errEl.innerHTML = msg;
	}
	calculate() {
		this.err('');
		try {
			let output = this.state.pap.evaluate(this.state.inputs.createValues(this.inputValues()));
			for (let out of this.state.outputs.vars) {
				this.form.elements[out.name].value = '' + output[out.name];
			}
		} catch(e) {
			this.err(e.toString());
			throw e;
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
	populatePAPCode() {
		this.codeEl.innerHTML = '';
		this.codeEl.appendChild(document.createTextNode(this.state.pap.expr.toString()));
	}
	inputValues() {
		let values = {};
		for (let input of this.state.inputs.vars) {
			values[input.name] = this.form.elements[input.name].value;
		}
		return values;
	}
}

function formField(varDecl, fieldTagName) {
	return el('div', {},
		el('label', {'for': varDecl.name}, textEl('span', varDecl.name)),
		el(fieldTagName, {name: varDecl.name}),
		textEl('div', varDecl.comment || ''),
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
