import {parsePAPXML} from './papparser.js';
import ast from '../expression/ast.js';
import {BlockExpression} from './extast.js';
import {PAPInterpreter} from './papinterpreter.js';
import {trace, InterpreterError} from '../expression/interpreter.js';
import {BigDecimal, newBigDecimal} from './bigdecimal.js';
import BigNumber from 'bignumber.js';

export function loadPAP(xmlStr) {
	return new PAP(parsePAPXML(xmlStr));
}

class PAP {
	constructor(papObj) {
		if (papObj.methods.filter(m => m.name === 'MAIN').length === 0) {
			throw new Error('No MAIN method specified within PAP XML');
		}
		this.name = papObj.name;
		this.vars = papObj.vars;
		this.expr = new BlockExpression([...papObj.methods, new ast.FunctionCallExpression(new ast.NameExpression('MAIN'), [])]);
	}
	inputs() {
		return new VarDeclarations(this.varDecls('INPUT'));
	}
	outputs() {
		return new VarDeclarations(this.varDecls('OUTPUT'));
	}
	defaults() {
		let scope = newScope();
		let interpreter = new PAPInterpreter(scope);
		let varScope = {};
		evaluateVars(this.vars, interpreter, varScope);
		return varScope;
	}
	varDecls(type) {
		let matcher = new RegExp(`^${type}(:|$)`);
		let v = this.vars.filter(v => v.varType.match(matcher)).map(v => new VarDeclaration(v.name, v.type, v.varType, v.comment));
		if (v.length === 0) {
			throw new Error(`No "${type}" var def found`);
		}
		return v;
	}
	evaluate(inputParams) {
		let scope = newScope();
		let interpreter = new PAPInterpreter(scope);
		trace(interpreter);
		this.trace = interpreter.evaluatedChildren;
		evaluateVars(this.vars, interpreter, scope);
		Object.assign(scope, inputParams);
		this.expr.visit(interpreter);
		let result = {};
		for (let output of this.outputs().vars) {
			let out = scope[output.name];
			if (out === undefined) {
				throw new Error(`Missing output ${output.name}`);
			}
			result[output.name] = out;
		}
		return result;
	}
}

function evaluateVars(vars, interpreter, scope) {
	for (let v of vars) {
		if (scope[v.name] !== undefined) {
			throw new Error(`Duplicate definition of PAP var ${v.name}`);
		}
		let value = v.evaluate(interpreter);
		if (value !== undefined) {
			scope[v.name] = value;
		}
	}
}

function validNumber(v) {
	let n = new BigNumber(v);
	if (n.isNaN() || !n.isFinite()) {
		throw new Error(`Invalid number provided: ${v}`);
	}
	return n;
}

const valueConverters = {
	BigDecimal: v => new BigDecimal(validNumber(v)),
	double: v => validNumber(v),
	int: v => {
		let n = validNumber(v);
		if (n.integerValue().toFixed() !== n.toFixed()) {
			throw new Error(`Invalid integer provided: ${v}`);
		}
		return n;
	},
}

class VarDeclaration {
	constructor(name, type, varType, comment) {
		this.name = name;
		this.type = type;
		this.varType = varType;
		this.comment = comment;
	}
}

class VarDeclarations {
	constructor(varDecls) {
		this.vars = varDecls;
	}
	createValues(input) {
		let converted = {};
		for (let v of this.vars) {
			let inVal = input[v.name];
			if (inVal === '' || inVal === undefined || inVal === null) {
				// TODO: do not set default values by type but let the user decide (easier for now for development)
				/*if (v.type === 'int' || v.type === 'double') {
					inVal = '0';
				} else {*/
					//throw new Error(`Undefined variable ${v.name}`);
					continue;
				//}
			}
			let converter = valueConverters[v.type];
			if (!converter) {
				throw new Error(`No input converter registered for type ${v.type}`);
			}
			try {
				converted[v.name] = converter(inVal);
			} catch(e) {
				e.message = `Input ${v.name}: ${e.message}`;
				throw e;
			}
		}
		return converted;
	}
}

const zero = new BigNumber(0);
const one = new BigNumber(1);

function newScope() {
	return {
		BigDecimal: {
			construct: newBigDecimal,
			valueOf: newBigDecimal,
			ZERO: new BigDecimal(zero),
			ONE: new BigDecimal(one),
			ROUND_UP: zero,
			ROUND_DOWN: one,
			toString: _ => 'BigDecimal',
		}
	};
}
