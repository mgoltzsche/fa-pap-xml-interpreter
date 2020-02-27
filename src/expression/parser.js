import ast from './ast.js';

class CharMatcher {
	static forChar(ch) {
		if (ch.length != 1) {
			throw new Error("Invalid char provided to CharMatcher.forChar: " + ch);
		}
		let code = ch.charCodeAt(0);
		return new CharMatcher(ch, c => code === c);
	}
	constructor(name, matcher) {
		this.name = name;
		this.match = matcher;
	}
	toString() {
		return name;
	}
}

const digitMatcher = c => c >= 48 && c <= 57;
const numberMatcher = c => digitMatcher(c) || c === 46
const signMatcher = c => c === 45;
const whitespace = new CharMatcher('WHITESPACE', c => c <= 32);
const digit = new CharMatcher('DIGIT', digitMatcher);
const number = new CharMatcher('NUMBER', numberMatcher);
const name = new CharMatcher('LETTER', c => c >= 65 && c <= 90 || c >= 97 && c <= 122 || c === 95 || digitMatcher(c));
const listStart = CharMatcher.forChar('{');
const listEnd = CharMatcher.forChar('}');
const callStart = CharMatcher.forChar('(');
const callEnd = CharMatcher.forChar(')');
const listItemSep = CharMatcher.forChar(',');
const dot = CharMatcher.forChar('.');
const equal = CharMatcher.forChar('=');
const plus = CharMatcher.forChar('+');
const minus = CharMatcher.forChar('-');
const sign = minus;
const exclamationMark = CharMatcher.forChar('!');
const anyMatcher = new CharMatcher('ITEM', c => true);

function match(matcher, parser) {
	return {matcher: matcher, parse: parser};
}

function parseNumber(ctx) {
	let s = ctx.parseToken(minus.match);
	ctx.skipWhitespace();
	let num = ctx.parseToken(number.match);
	if (num === '') {
		throw new ParserError('Unexpected end of number.');
	}
	return new ast.NumberExpression(s + num);
}

function parseName(ctx) {
	return new ast.NameExpression(ctx.parseToken(name.match));
}

const valueRule = [
	match(digit, parseNumber),
	match(minus, parseNumber),
	match(name, parseName),
	match(listStart, parseList),
];

function parseExpression(ctx) {
	let expr = ctx.parse(valueRule);
	if (expr instanceof ast.NameExpression && expr.name === 'new') {
		ctx.skipWhitespace();
		expr = new ast.ConstructorRefExpression(parseName(ctx));
	}
	return parseOperation(ctx, expr);
}

function parseOperation(ctx, leftOperand) {
	return ctx.parse([
		match(dot, dereferenceParser(leftOperand)),
		match(callStart, functionCallParser(leftOperand)),
		match(equal, assignmentOrEqualParser(leftOperand)),
		match(exclamationMark, notEqualParser(leftOperand)),
		match(plus, binaryOperationParser(leftOperand, '+', 'plus')),
		match(minus, binaryOperationParser(leftOperand, '-', 'minus')),
	], leftOperand);
}

function dereferenceParser(expr) {
	return ctx => {
		ctx.pos++;
		ctx.skipWhitespace();
		let name = parseName(ctx);
		name.targetExpr = expr;
		return parseOperation(ctx, name);
	}
}

function functionCallParser(ref) {
	return ctx => {
		let args = [];
		let list = parseListItems(ctx, args, callEnd, ctx => {
			let expr = new ast.FunctionCallExpression(ref, args);
			ctx.pos++;
			return expr;
		});
		return parseOperation(ctx, list);
	};
}

function parseList(ctx) {
	let list = [];
	return parseListItems(ctx, list, listEnd, ctx => {
		let expr = new ast.ListExpression(list);
		ctx.pos++;
		return expr;
	});
}

function parseListItems(ctx, items, endMatcher, buildExpr) {
	ctx.pos++;
	return ctx.parse([
		match(endMatcher, buildExpr),
		match(anyMatcher, ctx => {
			items.push(parseExpression(ctx));
			return parseListEnd(ctx, items, endMatcher, buildExpr);
		}),
	]);
}

function parseListEnd(ctx, items, endMatcher, buildExpr) {
	return ctx.parse([
		match(endMatcher, buildExpr),
		match(listItemSep, ctx => {
			ctx.pos++;
			return parseListItems(ctx, items, endMatcher, buildExpr)
		}),
	]);
}

function assignmentOrEqualParser(leftOperand) {
	return ctx => {
		ctx.pos++;
		return ctx.parse([
			match(equal, binaryOperationParser(leftOperand, '==', 'equal')),
			match(anyMatcher, assignmentParser(leftOperand)),
		]);
	}
}

function assignmentParser(varExpr) {
	return ctx => {
		return new ast.AssignmentExpression(varExpr, parseExpression(ctx));
	};
}

function notEqualParser(leftOperand) {
	return ctx => {
		ctx.pos++;
		return ctx.parse([
			match(equal, binaryOperationParser(leftOperand, '!=', 'notEqual')),
		]);
	};
}

function binaryOperationParser(leftOperand, opSymbol, opName) {
	return ctx => {
		ctx.pos++;
		return new ast.BinaryOperationExpression(opSymbol, opName, leftOperand, parseExpression(ctx));
	};
}

class ParserContext {
	constructor(expr) {
		this.expr = expr;
		this.pos = 0;
	}
	get char() {
		return this.expr.charAt(this.pos);
	}
	hasMore() {
		return this.pos < this.expr.length;
	}
	skipWhitespace() {
		this.parseToken(whitespace.match);
	}
	parseToken(match) {
		let startPos = this.pos;
		for (;this.pos < this.expr.length; this.pos++) {
			let cc = this.expr.charCodeAt(this.pos);
			if (!match(cc)) {
				break;
			}
		}
		return this.expr.substring(startPos, this.pos);
	}
	parse(rules, fallbackResult) {
		this.skipWhitespace();
		let cc = this.expr.charCodeAt(this.pos);
		let rule = ruleByChar(cc, rules);
		if (rule !== null) {
			let expr = rule.parse(this);
			this.skipWhitespace();
			return expr;
		} else if (fallbackResult) {
			return fallbackResult;
		} else {
			let expected = rules.map(r => r.matcher.name).join(', ');
			throw new ParserError('Unexpected character "' + this.char + '"! Expected ' + expected + '.');
		}
	}
	finish() {
		if (this.pos < this.expr.length) {
			throw new ParserError('Unexpected character "' + this.char + '" after end of expression!');
		}
	}
}

class ParserError extends Error {
	constructor(msg) {
		super(msg);
	}
}

function ruleByChar(c, rules) {
	for (let r of rules) {
		if (r.matcher.match(c)) {
			return r;
		}
	}
	return null;
}

function stateDescription(ctx) {
	return ' (position ' + ctx.pos + ')\n\n\t' + ctx.expr + '\n\t' + ' '.repeat(ctx.pos) + '^';
}

function parse(expr) {
	let ctx = new ParserContext(expr);
	try {
		let parsed = parseExpression(ctx);
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
