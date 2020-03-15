import {DOMParser} from 'xmldom';
import {parse} from '../expression/parser.js';
import ast from '../expression/ast.js';
import {PAPMethodExpression, IfExpression, BlockExpression} from './extast.js';

export function parsePAPXML(xmlStr) {
	let papDoc = new DOMParser().parseFromString(xmlStr);
	let docEl = papDoc.documentElement;
	if (docEl.tagName !== 'PAP') {
		throw new Error(`No PAP XML provided (PAP document element expected but found ${docEl.tagName})`);
	}
	let pap = attrs(docEl);
	let transformed = transformXML(docEl, papTransformer);
	return Object.assign(pap, transformed);
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
	let prev = element.previousSibling;
	while (prev && !prev.tagName) {
		if (prev.nodeType === 8) {
			return prev.nodeValue;
		}
		prev = prev.previousSibling;
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
	let exprStr = a.hasOwnProperty('value') ? a.value : a['default'];
	let expr = exprStr ? parse(exprStr) : null;
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
	IF: (n,a) => {
		let thenExprList = flatten(transformChildren(n, thenTransformers));
		let elseExprList = flatten(transformChildren(n, elseTransformers));
		if (thenExprList.length === 0) {
			throw new Error("IF XML expression tag has no THEN child");
		}
		return new IfExpression(parse(a.expr), new BlockExpression(thenExprList), elseExprList.length > 0 ? new BlockExpression(elseExprList) : null);
	},
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

function flatten(n) {
	return n.reduce((l,r) => {
			for (let i of l) {
				r.push(i);
			}
			return r;
		}, []);
}

class PAPVar {
	constructor(name, varType, type, expr, comment) {
		this.name = name;
		this.varType = varType;
		this.type = type;
		this.comment = comment;
		this.expr = expr;
	}
	evaluate(interpreter) {
		return this.expr ? this.expr.visit(interpreter) : undefined;
	}
}
