import ast from './ast.js';

const escapeRegex = /\+|\.|\||\*|\[|\]/g;
const matcher = regex => new RegExp(`^${regex}`);
const whitespace = matcher('\\s*');
const digit = matcher('[0-9]+');
const number = matcher('-?[0-9]+(\\.[0-9]+)?');
const name = matcher('[a-zA-Z0-9_]+');
const listStart = matcher('{');
const listEnd = matcher('}');
const bracketOpen = matcher('\\(');
const bracketClose = matcher('\\)');
const listItemSep = matcher(',');
const squareBracketOpen = matcher('\\[');
const squareBracketClose = matcher('\\]');
const dereference = matcher('\\.');
const anyMatcher = matcher('');
const op = (symbol,name,strength) => {
	return {
		matcher: matcher(symbol.replace(escapeRegex, '\\$&')),
		symbol: symbol,
		name: name,
		strength: strength
	};
};

function match(matcher, parser) {
	return {matcher: matcher, parse: parser};
}

function terminalNumber(ctx, num) {
	return new ast.NumberExpression(num);
}

function terminalName(ctx, name) {
	return new ast.NameExpression(name);
}

function parseParenthesis(ctx) {
	let expr = parseExpression(ctx, 0);
	ctx.parse(parenthesisCloseRule);
	return expr;
}

function parseOperand(ctx) {
	ctx.skipWhitespace();
	return ctx.parse(valueRule);
}

function parseExpression(ctx, i) {
	ctx.skipWhitespace();
	let expr = parseOperand(ctx);
	if (expr instanceof ast.NameExpression && expr.name === 'new') {
		ctx.skipWhitespace();
		expr = new ast.ConstructorRefExpression(ctx.parse(valueRule));
	}
	let pos = ctx.pos;
	while (ctx.hasMore()) {
		expr = parseOperation(ctx, expr, i);
		if (ctx.pos === pos) {
			break;
		}
		pos = ctx.pos;
	}
	return expr;
}

const operations = [
	op('||', 'or', 2),
	op('&&', 'and', 3),
	op('==', 'equal', 4),
	op('!=', 'notEqual', 4),
	op('=', 'assign', 1),
	op('>=', 'gte', 4),
	op('<=', 'lte', 4),
	op('>', 'gt', 4),
	op('<', 'lt', 4),
	op('+', 'plus', 5),
	op('-', 'minus', 5),
	op('*', 'multiply', 6),
	op('/', 'divide', 6),
];
const whitespaceRule = [match(whitespace, _ => {})];
const parenthesisCloseRule = [match(bracketClose, _ => {})];
const squareBracketCloseRule = [match(squareBracketClose, _ => {})];
const nameRule = [match(name, terminalName)];
const valueRule = [
	match(number, terminalNumber),
	nameRule[0],
	match(listStart, parseList),
	match(bracketOpen, parseParenthesis),
];

function parseOperation(ctx, leftOperand, i) {
	ctx.skipWhitespace();
	let rule = [
		match(bracketOpen, functionCallParser(leftOperand)),
		match(dereference, dereferenceParser(leftOperand)),
		match(squareBracketOpen, keyParser(leftOperand)),
	];
	operations.filter(op => op.strength >= i)
		.forEach(op => rule.push(match(op.matcher, binaryOperationParser(leftOperand, op.symbol, op.name, op.strength))));
	return ctx.parse(rule, leftOperand);
}

function dereferenceParser(expr) {
	return ctx => {
		if (expr instanceof ast.NumberExpression) {
			throw new ParserError('Cannot dereference number!');
		}
		ctx.skipWhitespace();
		let name = ctx.parse(nameRule);
		name.targetExpr = expr;
		return parseOperation(ctx, name);
	}
}

function keyParser(targetExpr) {
	return ctx => {
		ctx.skipWhitespace();
		let keyExpr = parseExpression(ctx);
		ctx.skipWhitespace();
		ctx.parse(squareBracketCloseRule);
		return new ast.KeyExpression(targetExpr, keyExpr);
	};
}

function functionCallParser(ref) {
	return ctx => {
		ctx.skipWhitespace();
		let args = [];
		return parseListItems(ctx, args, bracketClose, ctx => new ast.FunctionCallExpression(ref, args));
	};
}

function parseList(ctx) {
	ctx.skipWhitespace();
	let items = [];
	return parseListItems(ctx, items, listEnd, ctx => new ast.ListExpression(items));
}

function parseListItems(ctx, items, endMatcher, buildExpr) {
	ctx.skipWhitespace();
	return ctx.parse([
		match(endMatcher, buildExpr),
		match(anyMatcher, ctx => {
			items.push(parseExpression(ctx, 0));
			return ctx.parse([
				match(endMatcher, buildExpr),
				match(listItemSep, ctx => parseListItems(ctx, items, endMatcher, buildExpr)),
			]);
		}),
	]);
}

function binaryOperationParser(leftOperand, opSymbol, opName, i) {
	return ctx => {
		let expr = parseExpression(ctx, i + 1);
		return new ast.BinaryOperationExpression(opSymbol, opName, leftOperand, expr);
	}
}

class ParserContext {
	constructor(expr) {
		this.expr = expr;
		this.exprRest = expr;
		this.pos = 0;
	}
	get char() {
		return this.expr.charAt(this.pos);
	}
	hasMore() {
		return this.pos < this.expr.length;
	}
	skipWhitespace() {
		this.parse(whitespaceRule);
	}
	parse(rules, fallbackResult) {
		for (let r of rules) {
			let m = r.matcher.exec(this.exprRest);
			if (m) {
				let token = m[0];
				this.pos += token.length;
				this.exprRest = this.expr.substring(this.pos);
				return r.parse(this, token);
			}
		}
		if (fallbackResult) {
			return fallbackResult;
		} else {
			let expected = rules.map(r => r.matcher.source.substring(1)).join('|');
			throw new ParserError('Unexpected character "' + this.char + '"! Expected ' + expected + '.');
		}
	}
	finish() {
		if (this.hasMore()) {
			throw new ParserError('Unexpected character "' + this.char + '" after end of expression!');
		}
	}
}

class ParserError extends Error {
	constructor(msg) {
		super(msg);
	}
}

function stateDescription(ctx) {
	return ' (position ' + ctx.pos + ')\n\n\t' + ctx.expr + '\n\t' + ' '.repeat(ctx.pos) + '^';
}

function parse(expr) {
	let ctx = new ParserContext(expr);
	try {
		let parsed = parseExpression(ctx, 0);
		ctx.finish();
		return parsed;
	} catch(e) {
		if (e instanceof ast.SemanticError) {
			e = new ParserError(e.message + stateDescription(ctx));
		} else if (e instanceof ParserError) {
			e.message += stateDescription(ctx);
		}
		e.message = 'Cannot parse expression: ' + e.message;
		throw e;
	}
}

export { parse, ParserError };
