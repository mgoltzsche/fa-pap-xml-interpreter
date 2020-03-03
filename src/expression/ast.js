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
		return `{${this.exprList.join(',')}}`;
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
		return `${this.refExpr}(${this.argExprList.join(',')})`;
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

class KeyExpression {
	constructor(targetExpr, keyExpr) {
		this.targetExpr = targetExpr;
		this.keyExpr = keyExpr;
	}
	visit(visitor) {
		return visitor.key(this);
	}
	toString() {
		return `${this.targetExpr}[${this.keyExpr}]`;
	}
}

class BinaryOperationExpression {
	constructor(opSymbol, visitorOp, left, right) {
		if (opSymbol === '=') {
			if (!(left instanceof NameExpression) && !(left instanceof KeyExpression)) {
				throw new SemanticError(`Can only assign to name or list index but provided ${left}`);
			}
		}
		this.opSymbol = opSymbol;
		this.visitorOp = visitorOp;
		this.leftExpr = left;
		this.rightExpr = right;
		this.literal = false;
	}
	visit(visitor) {
		let op = visitor[this.visitorOp];
		if (!op) {
			throw new Error(`Unsupported visitor function "${this.visitorOp}"`);
		}
		return visitor[this.visitorOp](this.leftExpr, this.rightExpr);
	}
	toString() {
		let right = this.rightExpr instanceof BinaryOperationExpression ? `(${this.rightExpr})` : this.rightExpr;
		return `${this.leftExpr}${this.opSymbol}${right}`;
	}
}

class ConstructorRefExpression {
	constructor(typeRefExpr) {
		if (typeRefExpr.literal) {
			throw new SemanticError('Cannot use literal ' + typeRefExpr + ' as constructor');
		}
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

export default {
	SemanticError,
	NameExpression,
	NumberExpression,
	ListExpression,
	KeyExpression,
	FunctionCallExpression,
	BinaryOperationExpression,
	ConstructorRefExpression,
};
