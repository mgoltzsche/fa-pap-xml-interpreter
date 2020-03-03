import {DOMParser} from 'xmldom';
import BigNumber from 'bignumber.js';
import ast from '../expression/ast.js';
import {parse} from '../expression/parser.js';
import ExpressionInterpreter from '../expression/interpreter.js';

export function load(xmlstr) {
	return new PAP(new DOMParser().parseFromString(xmlstr));
}

function transformXML(el, transformers, r) {
	let transform = transformers[el.tagName];
	if (!transform) {
		throw new Error(`Unexpected tag "${el.tagName}" in PAP XML`);
	}
	return transform(el, attrs(el), r);
}

function transformChildren(el, transformers, r) {
	let l = [];
	for (let i in el.childNodes) {
		let n = el.childNodes[i];
		if (n.tagName) {
			l.push(transformXML(n, transformers, r));
		}
	}
	return l;
}

function getComment(element) {
	let prev = element.previousChild;
	while (prev && !prev.tagName) {
		if (prev.nodeType === 'comment') {
			return prev.nodeValue;
		}
		prev = prev.previousChild;
	}
	return null;
}

function transformVariable(el, a, r) {
	if (typeof a.name !== 'string') {
		throw new Error(`PAP ${el.tagName} has no "name" string property`);
	}
	if (typeof a.type !== 'string') {
		throw new Error(`PAP ${el.tagName} has no "type" string property`);
	}
	let expr = a.hasOwnProperty('value') ? a.value : a['default'];
	let varType = el.tagName;
	let parentType = attrs(el.parentNode).type;
	if (parentType) {
		varType += `:${parentType}`;
	}
	let varExpr = new PAPVar(a.name, varType, a.type, expr, getComment(el));
	r.vars.push(varExpr);
	return varExpr;
}

function transformMethod(el, a, r) {
	let name = a.name || 'MAIN';
	let expr = new PAPMethodExpression(name, new BlockExpression(transformChildren(el, exprTransformers)), getComment(el));
	r.methods.push(expr);
	return expr;
}

function attrs(n) {
	let o = {};
	for (let i in n.attributes) {
		let a = n.attributes[i];
		o[a.name] = a.nodeValue;
	}
	return o;
}

let papTransformer = {
	PAP: (n,a,r) => {
		if (r) {
			throw new Error('Unexpected PAP tag as child of PAP XML');
		}
		r = {vars: [], methods: []};
		transformChildren(n, papChildTransformer, r);
		return r;
	}
};
let transformPapChildren = (n,a,r) => transformChildren(n, papChildTransformer, r);
let papChildTransformer = {
	VARIABLES: transformPapChildren,
	INPUTS: transformPapChildren,
	OUTPUTS: transformPapChildren,
	INTERNALS: transformPapChildren,
	CONSTANTS: transformPapChildren,
	INPUT: transformVariable,
	OUTPUT: transformVariable,
	INTERNAL: transformVariable,
	CONSTANT: transformVariable,
	METHODS: transformPapChildren,
	METHOD: transformMethod,
	MAIN: transformMethod,
};
let exprTransformers = {
	IF: (n,a) => new IfExpression(parse(a.expr), new BlockExpression(transformChildren(n, thenTransformers)[0]), new BlockExpression(transformChildren(n, elseTransformers)[0])),
	EVAL: (n,a) => parse(a.exec),
	EXECUTE: (n,a) => new ast.FunctionCallExpression(new ast.NameExpression(a.method), []),
};
let thenTransformers = {
	THEN: (n,a,r) => transformChildren(n, exprTransformers, r),
	ELSE: _ => []
};
let elseTransformers = {
	THEN: _ => [],
	ELSE: (n,a,r) => transformChildren(n, exprTransformers, r)
};

class PAP {
	constructor(pap) {
		let docEl = pap.documentElement;
		if (docEl.tagName !== 'PAP') {
			throw new Error('No PAP XML provided');
		}
		let obj = transformXML(docEl, papTransformer);
		if (obj.methods.filter(m => m.name === 'MAIN').length === 0) {
			throw new Error('No MAIN method specified within PAP XML');
		}
		this.vars = obj.vars;
		this.expr = new BlockExpression([...obj.methods, new ast.FunctionCallExpression(new ast.NameExpression('MAIN'), [])]);
	}
	inputs() {
		return this.varDefs('INPUT');
	}
	outputs() {
		return this.varDefs('OUTPUT');
	}
	varDefs(type) {
		let matcher = new RegExp(`^${type}(:|$)`);
		return this.vars.filter(v => v.varType.match(matcher)).map(v => {return {
			name: v.name,
			type: v.type,
		};});
	}
	evaluate(inputParams) {
		let scope = newScope();
		let interpreter = new PAPInterpreter(scope);
		populateScope(scope, interpreter, this.vars);
		Object.assign(scope, inputParams);
		this.expr.visit(interpreter);
		let result = {};
		for (let output of this.outputs()) {
			let out = scope[output.name];
			if (out === undefined) {
				throw new Error(`Missing output ${output.name}`);
			}
			result[output.name] = out;
		}
		return result;
	}
}

function populateScope(scope, interpreter, vars) {
	for (let varDef of vars) {
		if (scope[varDef.name] !== undefined) {
			throw new Error(`Duplicate definition of PAP var ${varDef.name}`);
		}
		scope[varDef.name] = varDef.evaluate(interpreter);
	}
}

export class BigDecimal {
	constructor(num) {
		this.num = num;
	}
	setScale(scale, roundingMode) {
		let BN = BigNumber.clone({DECIMAL_PLACES: toInt(scale), ROUNDING_MODE: toInt(roundingMode)});
		return new BigDecimal(new BN(this.num.toFixed()));
	}
	add(n) {
		return new BigDecimal(this.num.plus(n.num));
	}
	subtract(n) {
		return new BigDecimal(this.num.minus(n.num));
	}
	multiply(n) {
		return new BigDecimal(this.num.times(n.num));
	}
	divide(n) {
		return new BigDecimal(this.num.div(n.num));
	}
	compareTo(n) {
		if (!(n instanceof BigDecimal)) {
			throw new Error('No BigDecimal provided to compareTo(o)');
		}
		return new BigNumber(this.num.comparedTo(n.num));
	}
	toString() {
		return this.num.toString();
	}
}

function toInt(num) {
	let numStr = num.toFixed();
	let i = parseInt(numStr);
	if (numStr !== '' + i) {
		throw new Error(`Cannot convert "${num}" to int`);
	}
	return i;
}

function newScope() {
	return {
		BigDecimal: {
			construct: function(n) {
				return new BigDecimal(n);
			},
			ZERO: new BigDecimal(new BigNumber(0)),
			ONE: new BigDecimal(new BigNumber(1)),
			ROUND_UP: new BigNumber(0),
			ROUND_DOWN: new BigNumber(1),
		}
	};
}

class PAPVar {
	constructor(name, varType, type, expr, comment) {
		this.name = name;
		this.varType = varType;
		this.type = type;
		this.comment = comment;
		this.expr = null;
		if (expr) {
			this.expr = parse(expr);
		}
	}
	evaluate(interpreter) {
		return this.expr ? this.expr.visit(interpreter) : undefined;
	}
}

class PAPMethodExpression {
	constructor(name, expr, comment) {
		this.name = name;
		this.expr = expr;
		this.comment = comment;
	}
	visit(visitor) {
		return visitor.methodExpr(this);
	}
	toString() {
		return `function ${this.name}() ${this.expr}`;
	}
}

class IfExpression {
	constructor(condExpr, thenExpr, elseExpr) {
		this.condExpr = condExpr;
		this.thenExpr = thenExpr;
		this.elseExpr = elseExpr;
	}
	visit(visitor) {
		return visitor.ifExpr(this);
	}
	toString() {
		return `if (${this.condExpr}) ${this.thenExpr} else ${this.elseExpr}`;
	}
}

class BlockExpression {
	constructor(exprList) {
		if (!exprList.map) {
			throw new Error(`No expressions provided: ${typeof exprList}: ${exprList}`);
		}
		this.exprList = exprList;
	}
	visit(visitor) {
		try {
			return visitor.blockExpr(this);
		} catch(e) {
			if (!e.errInfoAdded) {
				e.message += `\n\terror occured in code block:\n\t\t${this.toString().replace(/\n/g, '\n\t\t')}`;
				e.errInfoAdded = true;
			}
			throw e;
		}
	}
	toString() {
		let items = this.exprList.map(e => `\n${e}`).join('').replace(/\n/g, '\n  ');
		return `{${items}\n}`;
	}
}

class PAPInterpreter extends ExpressionInterpreter {
	constructor(scope) {
		super(scope);
	}
	blockExpr(expr) {
		let self = this;
		let m = expr.exprList.map(e => e.visit(self));
		if (m.length === 0) {
			return null;
		}
		return m[m.length - 1];
	}
	ifExpr(expr) {
		let cond = expr.condExpr.visit(this);
		let t = typeof cond;
		if (t !== 'boolean') {
			throw new Error(`condition expression ${expr.condExpr} must return a boolean but returned ${t}`);
		}
		if (cond) {
			return expr.thenExpr.visit(this);
		}
		return expr.elseExpr.visit(this);
	}
	methodExpr(expr) {
		if (this.scope[expr.name] !== undefined) {
			throw new Error(`Duplicate definition of PAP scope name ${varDef.name} (method)`);
		}
		let fn = expr.expr.visit.bind(expr.expr, this);
		this.scope[expr.name] = fn;
		return fn;
	}
}
