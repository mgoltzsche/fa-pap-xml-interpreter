const numberRegex = /^-?[0-9]+(\.[0-9]+)?$/

class SemanticError extends Error {
	constructor(msg) {
		super(msg);
	}
}

class ListExpression {
	constructor(list) {
		this.exprList = list;
		this.literal = false;
	}
	visit(visitor) {
		return visitor.list(this.exprList);
	}
	toString() {
		return '{' + this.exprList.join(', ') + '}';
	}
}

class FunctionCallExpression {
	constructor(ref, args) {
		if (ref.literal) {
			throw new SemanticError('Cannot invoke function on literal ' + ref);
		}
		this.refExpr = ref;
		this.argExprList = args;
		this.literal = false;
	}
	visit(visitor) {
		return visitor.call(this);
	}
	toString() {
		return this.refExpr + '(' + this.argExprList.join(',') + ')';
	}
}

class NumberExpression {
	constructor(num) {
		this.num = num;
		if (!num.match(numberRegex)) {
			throw new SemanticError('Invalid number "' + num + '" provided!');
		}
		this.literal = true;
	}
	visit(visitor) {
		return visitor.number(this.num);
	}
	toString() {
		return this.num;
	}
}

class NameExpressionBase {
	constructor(name) {
		if (name === '') {
			throw new SemanticError('No name provided!');
		}
		this.name = name;
		this.literal = false;
	}
}

class NameExpression extends NameExpressionBase {
	constructor(name) {
		super(name);
		this.targetExpr = null;
	}
	visit(visitor) {
		return visitor.name(this);
	}
	toString() {
		let name = this.name;
		if (this.targetExpr) {
			name = this.targetExpr + '.' + name;
		}
		return name;
	}
}

class ConstructorRefExpression {
	constructor(typeRefExpr) {
		this.typeRefExpr = typeRefExpr;
		this.literal = false;
	}
	visit(visitor) {
		return visitor.constructorRef(this);
	}
	toString() {
		return 'new ' + this.typeRefExpr;
	}
}

class BinaryOperationExpression {
	constructor(opSymbol, visitorOp, left, right) {
		this.opSymbol = opSymbol;
		this.visitorOp = visitorOp;
		this.leftExpr = left;
		this.rightExpr = right;
		this.literal = false;
	}
	visit(visitor) {
		return visitor[this.visitorOp](this.leftExpr, this.rightExpr);
	}
	toString() {
		return this.leftExpr + this.opSymbol + this.rightExpr;
	}
}

class AssignmentExpression extends BinaryOperationExpression {
	constructor(ref, expr) {
		super('=', 'assign', ref, expr);
		if (!(ref instanceof NameExpression)) {
			throw new SemanticError('Cannot assign to ' + ref);
		}
	}
}

export default {
	SemanticError,
	NameExpression,
	NumberExpression,
	ListExpression,
	ConstructorRefExpression,
	FunctionCallExpression,
	BinaryOperationExpression,
	AssignmentExpression,
};
