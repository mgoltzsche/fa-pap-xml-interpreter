import BigNumber from 'bignumber.js';

BigNumber.set({DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP})

// Makes the interpreter collect all evaluation results in the 'evaluated' list.
export function trace(interpreter) {
	interpreter.evaluatedChildren = [];
	interpreter.evaluationStack = [interpreter];
	for (const name of props(interpreter)) {
		let fn = interpreter[name];
		if (typeof fn === 'function') {
			interpreter[name] = ((fn,expr,parentPartName) => {
				let traceItem = {type: name, expr: expr, value: undefined, evaluatedChildren: [], condition: null};
				if (!expr.literal) {
					let currStackItem = interpreter.evaluationStack[interpreter.evaluationStack.length-1];
					if (parentPartName) {
						if (currStackItem[parentPartName]) {
							throw new Error(`Last trace stack item's named sub trace "${parentPartName}" is already set`);
						}
						currStackItem[parentPartName] = traceItem;
					} else {
						currStackItem.evaluatedChildren.push(traceItem);
					}
				}
				interpreter.evaluationStack.push(traceItem);
				let v = fn.call(interpreter, expr);
				interpreter.evaluationStack.pop();
				traceItem.value = v;
				return v;
			}).bind(null, fn)
		}
	}
}

function props(obj) {
    var p = [];
    for (; obj != null; obj = Object.getPrototypeOf(obj)) {
        var op = Object.getOwnPropertyNames(obj);
        for (var i=0; i<op.length; i++)
            if (p.indexOf(op[i]) == -1)
                 p.push(op[i]);
    }
    return p;
}

export class InterpreterError extends Error {
	constructor(msg, expr, scope) {
		super(msg);
		this.expr = expr;
		this.scope = scope;
	}
}

export class ExpressionInterpreter {
	constructor(scope) {
		if (typeof scope !== 'object') {
			throw new Error('no scope of type object provided');
		}
		this.scope = scope;
	}
	number(expr) {
		return new BigNumber(''+expr.num);
	}
	name(expr) {
		let targetObj = this.scope;
		if (expr.targetExpr) {
			targetObj = expr.targetExpr.visit(this);
			if (typeof targetObj !== 'object') {
				throw new InterpreterError(`${expr.targetExpr} is not an object`, expr.targetExpr, this.scope);
			}
		}
		let v = targetObj[expr.name];
		if (v === undefined || v === null) {
			throw new InterpreterError(`${expr} is ${v}`, expr, this.scope);
		}
		if (typeof v === 'function') {
			v = v.bind(targetObj);
		}
		return v;
	}
	list(exprList) {
		return exprList.map(e => e.visit(this));
	}
	key(expr) {
		let target = expr.targetExpr.visit(this);
		let key = expr.keyExpr.visit(this);
		if (!(target instanceof Array)) {
			throw new InterpreterError(`target expression ${expr.targetExpr} is not a list`, expr.targetExpr, this.scope);
		}
		let n = new BigNumber(key);
		if (n.toFixed() !== n.integerValue().toFixed()) {
			throw new InterpreterError(`index expression ${expr.keyExpr} is not an int`, expr.keyExpr, this.scope);
		}
		let value = target[key];
		if (value === undefined || value === null) {
			throw new InterpreterError(`expression ${expr} returned ${value}`, expr, this.scope);
		}
		return value;
	}
	constructorRef(expr) {
		let constr = expr.typeRefExpr.visit(this);
		if (typeof constr !== 'object' || typeof constr.construct !== 'function') {
			throw new InterpreterError(`${expr.typeRefExpr} is not constructable`, expr.typeRefExpr, this.scope);
		}
		return constr.construct;
	}
	call(expr) {
		let fn = expr.refExpr.visit(this);
		let t = typeof fn;
		if (t !== 'function') {
			throw new InterpreterError(`${expr.refExpr} is not a function but ${t}`, expr.refExpr, this.scope);
		}
		let args = expr.argExprList.map(e => e.visit(this));
		let v;
		try {
			v = fn.apply(null, args);
		} catch(e) {
			e.message = `${expr}: ${e.message}`;
			throw e;
		}
		if (v === undefined || v === null) {
			throw new InterpreterError(`${expr} returned ${v}`, expr, this.scope);
		}
		return v;
	}
	assign(expr) {
		let targetExpr = expr.leftExpr;
		let valueExpr = expr.rightExpr;
		let targetObj = this.scope;
		if (targetExpr.targetExpr) {
			targetObj = targetExpr.targetExpr.visit(this);
			let t = typeof targetObj
			if (t !== 'object') {
				throw new InterpreterError(`cannot dereference ${targetExpr.targetExpr} since it is not an object but ${t}`, targetExpr.targetExpr, this.scope);
			}
		}
		let v = valueExpr.visit(this);
		if (v === undefined || v === null) {
			throw new InterpreterError(`${valueExpr} returned ${v}`, valueExpr, this.scope);
		}
		let key = targetExpr.name;
		if (targetExpr.keyExpr) {
			key = targetExpr.keyExpr.visit(this);
		}
		targetObj[key] = v;
		return v;
	}
	equal(expr) {
		return equal(this, expr);
	}
	notEqual(expr) {
		return !equal(this, expr);
	}
	or(expr) {
		return binaryOperationExpression(this, expr, requireBool, (a,b) => a || b);
	}
	and(expr) {
		return binaryOperationExpression(this, expr, requireBool, (a,b) => a && b);
	}
	plus(expr) {
		return binaryOperationExpression(this, expr, requireNumber, (a,b) => a.plus(b));
	}
	minus(expr) {
		return binaryOperationExpression(this, expr, requireNumber, (a,b) => a.minus(b));
	}
	multiply(expr) {
		return binaryOperationExpression(this, expr, requireNumber, (a,b) => a.times(b));
	}
	divide(expr) {
		return binaryOperationExpression(this, expr, requireNumber, (a,b) => a.div(b));
	}
	gt(expr) {
		return binaryOperationExpression(this, expr, requireNumber, (a,b) => a.gt(b));
	}
	lt(expr) {
		return binaryOperationExpression(this, expr, requireNumber, (a,b) => a.lt(b));
	}
	gte(expr) {
		return binaryOperationExpression(this, expr, requireNumber, (a,b) => a.gte(b));
	}
	lte(expr) {
		return binaryOperationExpression(this, expr, requireNumber, (a,b) => a.lte(b));
	}
}

function equal(interpreter, expr) {
	let left = expr.leftExpr.visit(interpreter);
	let right = expr.rightExpr.visit(interpreter);
	if (left instanceof BigNumber && right instanceof BigNumber) {
		left = left.toFixed();
		right = right.toFixed();
	}
	return left === right;
}

function binaryOperationExpression(interpreter, expr, typeSafeOperand, op) {
	try {
		let left = typeSafeOperand(interpreter, expr.leftExpr);
		let right = typeSafeOperand(interpreter, expr.rightExpr);
		return op(left, right);
	} catch(e) {
		e.message = `${expr.opSymbol} operation ${expr} failed: ${e.message}`;
		throw e;
	}
}
function requireNumber(interpreter, expr) {
	let v = expr.visit(interpreter);
	if (!(v instanceof BigNumber) || v.isNaN() || !v.isFinite()) {
		throw new InterpreterError(`numeric (BigNumber) value required but ${expr} returned ${typeof v}($v)`, expr, interpreter.scope);
	}
	return v;
}
function requireBool(interpreter, expr) {
	let v = expr.visit(interpreter);
	let t = typeof v;
	if (t !== 'boolean') {
		throw new InterpreterError(`numeric value required but ${expr} returned ${t}`, expr, interpreter.scope);
	}
	return v;
}
