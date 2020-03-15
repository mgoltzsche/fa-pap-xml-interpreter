import {ExpressionInterpreter} from '../expression/interpreter.js';

export class PAPInterpreter extends ExpressionInterpreter {
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
		if (this.condExpr(expr.condExpr, 'condition')) {
			return this.thenExpr(expr.thenExpr);
		} else if (expr.elseExpr) {
			return this.elseExpr(expr.elseExpr);
		}
		return null;
	}
	condExpr(expr) {
		let cond = expr.visit(this);
		if (typeof cond !== 'boolean') {
			throw new Error(`condition expression ${expr.condExpr} must return a boolean but returned ${humanReadable(cond)}`);
		}
		return cond;
	}
	thenExpr(expr) {
		return expr.visit(this);
	}
	elseExpr(expr) {
		return expr.visit(this);
	}
	methodExpr(expr) {
		if (this.scope[expr.name] !== undefined) {
			throw new Error(`Duplicate definition of PAP scope name ${expr.name} (method)`);
		}
		let fn = _ => {
			expr.expr.visit(this);
			return true;
		};
		this.scope[expr.name] = fn;
		return fn;
	}
}
