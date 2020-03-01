import {DOMParser} from 'xmldom';
import BigNumber from 'bignumber.js';
import ast from '../expression/ast.js';
import {parse} from '../expression/parser.js';
import evaluate from '../expression/interpreter.js';

export default function load(xmlstr) {
	return new PAP(new DOMParser().parseFromString(xmlstr));
}

function transformXML(el, transformers, r, comment) {
	let transform = transformers[el.tagName];
	if (!transform) {
		throw new Error(`Unexpected tag "${el.tagName}" in PAP XML`);
	}
	return transform(el, attrs(el), r, comment);
}

function transformChildren(el, transformers, r) {
	let comment = null;
	let l = [];
	for (let i in el.childNodes) {
		let n = el.childNodes[i];
		if (n.nodeType === 'comment') {
			c.comment = n.nodeValue
		} else if (n.tagName) {
			l.push(transformXML(n, transformers, r, comment));
			comment = null;
		}
	}
	return l;
}

function transformVariable(el, a, r, comment) {
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
		varType += `:${varType}`;
	}
	let varExpr = new PAPVar(a.name, varType, a.type, expr, comment);
	r.vars.push(varExpr);
	return varExpr;
}

function transformMethod(el, a, r, comment) {
	let name = a.name || 'MAIN'
	if (r.methods[name]) {
		throw new Error('Duplicate method: ' + name);
	}
	let expr = new PAPMethod(name, transformChildren(el, exprTransformers), comment);
	r.methods[name] = expr;
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

let papTransformers = {
	PAP: (n,a,r) => {
		if (r) {
			throw new Error('Unexpected PAP tag as child of PAP XML');
		}
		r = {vars: [], methods: {}};
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
	IF: (n,a) => new IfExpression(parse(a.expr), transformChildren(n, thenTransformers)[0], transformChildren(n, elseTransformers)[0]),
	EVAL: (n,a) => parse(a.exec),
	EXECUTE: (n,a) => new ast.FunctionCallExpression(new ast.NameExpression(a.method), []),
};
let thenTransformers = {
	THEN: n => (n,a,r) => transformChildren(n, exprTransformers, r),
	ELSE: n => []
};
let elseTransformers = {
	THEN: n => [],
	ELSE: n => (n,a,r) => transformChildren(n, exprTransformers, r)
};

class PAP {
	constructor(pap) {
		console.log(pap);
		let docEl = pap.documentElement;
		if (docEl.tagName !== 'PAP') {
			throw new Error('No PAP XML provided');
		}
		let obj = transformXML(docEl, papTransformers);
		this.vars = obj.vars;
		this.methods = obj.methods;
		if (!this.methods.MAIN) {
			throw new Error('No MAIN method specified within PAP XML');
		}

		console.log(obj);
	}
	evaluate(input) {
		let scope = this.buildScope();
		Object.assign(scope, input);
		evaluate(this.methods.MAIN, scope);
	}
	buildScope() {
		let scope = newScope();
		this.populateScope(scope);
		return scope;
	}
	populateScope(scope) {
		for (let varDef of this.vars) {
			if (scope[varDef.name] !== undefined) {
				throw new Error('Duplicate definition of PAP var ${varDef.name}');
			}
			scope[varDef.name] = varDef.evaluate(scope);
		}
		for (let procDef of this.methods) {
			if (scope[procDef.name] !== undefined) {
				throw new Error('Duplicate definition of PAP scope name ${varDef.name} (method)');
			}
			scope[procDef.name] = function(expr) {
				return expr.visit(scope);
			}.bind(null, procDef);
		}
	}
}

class BigDecimal {
	constructor(num) {
		this.num = num;
	}
	toString() {
		return this.num.toString();
	}
}

function newScope() {
	return {
		BigDecimal: {
			construct: function(n) {
				return new BigDecimal(n);
			},
			ONE: new BigDecimal(new BigNumber(0))
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
	evaluate(scope) {
		return this.expr ? evaluate(this.expr, scope) : undefined;
	}
}

class PAPMethod {
	constructor(name, exprList, comment) {
		this.name = name;
		this.exprList = exprList;
		this.comment = comment;
	}
	evaluate(scope) {
		return this.exprList.reduce(null, (_,expr) => evaluate(expr, scope));
	}
}

class IfExpression {
	constructor(condExpr, thenExpr, elseExpr) {
		this.condExpr = condExpr;
		this.thenExpr = thenExpr;
		this.elseExpr = elseExpr;
	}
	visit(visitor) {
		let cond = this.condExpr.visit(visitor);
		let t = typeof cond;
		if (t !== 'boolean') {
			throw new Error(`condition expression ${this.condExpr} must return a boolean but returned ${t}`);
		}
		if (cond) {
			return this.thenExpr.visit(visitor);
		}
		return this.elseExpr.visit(visitor);
	}
	toString() {
		return `if (${this.condExpr}) ${this.thenExpr} else ${this.elseExpr}`;
	}
}

class BlockExpression {
	constructor(exprList) {
		this.exprList = exprList;
	}
	visit(visitor) {
		return this.exprList.reduce(null, (_,expr) => expr.visit(visitor));
	}
	toString() {
		let item = this.exprList.map(e => `\n  ${e}`).join('');
		return `{${items}\n}`;
	}
}
