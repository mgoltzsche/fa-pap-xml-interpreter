export class PAPMethodExpression {
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

export class IfExpression {
	constructor(condExpr, thenExpr, elseExpr) {
		this.condExpr = condExpr;
		this.thenExpr = thenExpr;
		this.elseExpr = elseExpr;
	}
	visit(visitor) {
		return visitor.ifExpr(this);
	}
	toString() {
		let elseExpr = '';
		if (this.elseExpr && this.elseExpr.exprList.length > 0) {
			elseExpr = ` else ${this.elseExpr}`;
		}
		return `if (${this.condExpr}) ${this.thenExpr}${elseExpr}`;
	}
}

export class BlockExpression {
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
				e.message += `\n\texpression context:\n\t\t${this.toString().replace(/\n/g, '\n\t\t')}`;
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
