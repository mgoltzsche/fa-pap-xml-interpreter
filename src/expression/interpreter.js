import BigNumber from 'bignumber.js';

export default function evaluate(expr, scope) {
	return expr.visit(new ExpressionInterpreter(scope));
}

class ExpressionInterpreter {
	constructor(scope) {
		if (typeof scope !== 'object') {
			throw new Error('no scope of type object provided');
		}
		this.scope = scope;
	}
	number(num) {
		return new BigNumber(num);
	}
	name(expr) {
		let targetObj = this.scope;
		if (expr.targetExpr) {
			targetObj = expr.targetExpr.visit(this);
			if (typeof targetObj !== 'object') {
				throw new Error(expr.targetExpr + ' is not an object');
			}
		}
		let v = targetObj[expr.name];
		if (v === undefined) {
			throw new Error(expr + ' is undefined');
		}
		if (typeof v === 'function') {
			v = v.bind(targetObj);
		}
		return v;
	}
	list(exprList) {
		return exprList.map(e => e.visit(this));
	}
	constructorRef(expr) {
		let constr = expr.typeRefExpr.visit(this);
		if (typeof constr !== 'object' || typeof constr.construct !== 'function') {
			throw new Error(expr.typeRefExpr + ' is not constructable');
		}
		return constr.construct;
	}
	call(expr) {
		let fn = expr.refExpr.visit(this);
		let t = typeof fn;
		if (t !== 'function') {
			throw new Error(expr.refExpr + ' is not a function but ' + t);
		}
		let args = expr.argExprList.map(e => e.visit(this));
		let v;
		try {
			v = fn.apply(null, args);
		} catch(e) {
			e.message = 'failed to call ' + expr + ': ' + e.message;
			throw e;
		}
		if (v === undefined) {
			throw new Error(expr + ' returned undefined');
		}
		return v;
	}
	assign(nameExpr, valueExpr) {
		let targetObj = this.scope;
		if (nameExpr.targetExpr) {
			targetObj = nameExpr.targetExpr.visit(this);
			let t = typeof targetObj
			if (t !== 'object') {
				throw new Error('cannot dereference ' + nameExpr.targetExpr + ' since it is not an object but ' + t);
			}
		}
		let v = valueExpr.visit(this);
		if (v === undefined) {
			throw new Error(valueExpr + ' returned undefined');
		}
		targetObj[nameExpr.name] = v;
		return v;
	}
	equal(leftExpr, rightExpr) {
		let left = leftExpr.visit(this);
		let right = rightExpr.visit(this);
		if (left instanceof BigNumber && right instanceof BigNumber) {
			left = left.toFixed();
			right = right.toFixed();
		}
		return left === right;
	}
	notEqual(leftExpr, rightExpr) {
		return !this.equal(leftExpr, rightExpr);
	}
	or(leftExpr, rightExpr) {
		return this.requireBool(leftExpr, '||') || this.requireBool(rightExpr, '||');
	}
	and(leftExpr, rightExpr) {
		return this.requireBool(leftExpr, '&&') && this.requireBool(rightExpr, '&&');
	}
	plus(leftExpr, rightExpr) {
		return this.requireNumber(leftExpr, '+').plus(this.requireNumber(rightExpr, '+'));
	}
	minus(leftExpr, rightExpr) {
		return this.requireNumber(leftExpr, '-').minus(this.requireNumber(rightExpr, '-'));
	}
	multiply(leftExpr, rightExpr) {
		return this.requireNumber(leftExpr, '*').times(this.requireNumber(rightExpr, '*'));
	}
	divide(leftExpr, rightExpr) {
		return this.requireNumber(leftExpr, '/').div(this.requireNumber(rightExpr, '/'));
	}
	gt(leftExpr, rightExpr) {
		return this.requireNumber(leftExpr, '>').gt(this.requireNumber(rightExpr, '>'));
	}
	lt(leftExpr, rightExpr) {
		return this.requireNumber(leftExpr, '<').lt(this.requireNumber(rightExpr, '<'));
	}
	gte(leftExpr, rightExpr) {
		return this.requireNumber(leftExpr, '>=').gte(this.requireNumber(rightExpr, '>='));
	}
	lte(leftExpr, rightExpr) {
		return this.requireNumber(leftExpr, '<=').lte(this.requireNumber(rightExpr, '<='));
	}
	requireNumber(expr, op) {
		let v = expr.visit(this);
		if (!(v instanceof BigNumber)) {
			throw new Error(op + ' operation requires numeric operands but ' + expr + ' returned ' + (typeof v));
		}
		return v;
	}
	requireBool(expr, op) {
		let v = expr.visit(this);
		let t = typeof v;
		if (t !== 'boolean') {
			throw new Error(op + ' operation requires boolean operands but ' + expr + ' returned ' + t);
		}
		return v;
	}
}
