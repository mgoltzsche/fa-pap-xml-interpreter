import assert from 'assert';
import ast from '../../src/expression/ast.js';
import ExpressionInterpreter from '../../src/expression/interpreter.js';
import {parse} from '../../src/expression/parser.js';
import BigNumber from 'bignumber.js';

describe('expression', function() {
	testCases('evaluate(exprAST)', input => input, []);
	testCases('evaluate(parse(exprStr))', input => parse(input.toString()), [
		['v = 7 + 11 - 8', new BigNumber(10), 'v'],
		['mynum - 1', new BigNumber(122.5)],
		['1 < 2', true],
		['1 <= 2', true],
		['2 < 2', false],
		['2 <= 2', true],
		['2 > 1', true],
		['2 >= 1', true],
		['2 > 2', false],
		['2 >= 2', true],
		['x = 3 + 7', new BigNumber(10), 'x'],
		['5 + 3 - 7', new BigNumber(1)],
		['5 == 8 - 3', true],
		['x = mynum == myvar || mynum == 123.5', true, 'x'],
		['x = 5 == func(3, 2).b + 3', true, 'x'],
		['x = 5 == 3 + func(3, 2).b', true, 'x'],
		['5 + calc(1,2) * 7', new BigNumber(26)],
		['5 + calc(1,2) / 6', new BigNumber(5.5)],
		['4 + mylist[0]', new BigNumber(127.5)],
	]);
})

function testCases(name, mapInput, addCases) {
	describe(name, function() {
		let fn = (a,b) => {return {a: a, b: b}};
		let calcFn = (a,b) => a.plus(b);
		let num1 = new BigNumber('123.5');
		let num2 = new BigNumber('0.00350000005400000456');
		let num1Expr = new ast.NumberExpression(num1.toFixed());
		let num2Expr = new ast.NumberExpression(num2.toFixed());
		let plusResult = num1.plus(num2);
		let minusResult = num1.minus(num2);
		let resolvedName = 'resolved name'
		let nameExpr = new ast.NameExpression('myvar');
		let constrExpr = new ast.ConstructorRefExpression(new ast.NameExpression('MyType'));
		let scopeName = 'newVar';
		let cases = [
			[num1Expr, num1],
			[nameExpr, resolvedName],
			[new ast.ListExpression([nameExpr, num1Expr]), [resolvedName, num1]],
			[new ast.KeyExpression(new ast.ListExpression([nameExpr, num1Expr]), new ast.NumberExpression('1')), num1],
			[constrExpr, function(){}],
			[new ast.FunctionCallExpression(new ast.NameExpression('func'), [num1Expr, nameExpr]), fn(num1, resolvedName)],
			[new ast.FunctionCallExpression(constrExpr, [num1Expr, nameExpr]), fn(num1, resolvedName)],
			[new ast.BinaryOperationExpression('=', 'assign', new ast.NameExpression(scopeName), num1Expr), num1, scopeName],
			[new ast.BinaryOperationExpression('+', 'plus', num1Expr, num2Expr), plusResult],
			[new ast.BinaryOperationExpression('-', 'minus', num1Expr, num2Expr), minusResult],
			[new ast.BinaryOperationExpression('*', 'multiply', num1Expr, num2Expr), num1.multipliedBy(num2)],
			[new ast.BinaryOperationExpression('/', 'divide', num1Expr, num2Expr), num1.dividedBy(num2)],
			[new ast.BinaryOperationExpression('==', 'equal', num1Expr, num2Expr), false],
			[new ast.BinaryOperationExpression('!=', 'notEqual', num1Expr, num2Expr), true],
			[new ast.BinaryOperationExpression('==', 'equal', num1Expr, num1Expr), true],
			[new ast.BinaryOperationExpression('!=', 'notEqual', num1Expr, num1Expr), false],
			[new ast.BinaryOperationExpression('==', 'equal', nameExpr, nameExpr), true],
			[new ast.BinaryOperationExpression('!=', 'notEqual', new ast.NameExpression('mystr'), num1Expr), true],
			[new ast.BinaryOperationExpression('<', 'lt', num1Expr, num2Expr), false],
			[new ast.BinaryOperationExpression('>', 'gt', num1Expr, num2Expr), true],
			...addCases
		];
		for (let c of cases) {
			let constrName = c[0].constructor ? ' ' + c[0].constructor.name : '';
			it('should evaluate' + constrName + ': ' + c[0], function(c) {
				let scope = {
					myvar: resolvedName,
					mystr: 'mockstring',
					mynum: num1,
					mylist: [num1],
					func: fn,
					calc: calcFn,
					MyType: {construct: fn},
				}
				let actual = mapInput(c[0]).visit(new ExpressionInterpreter(scope));
				let expected = c[1];
				assertEqual(expected, actual);
				if (c.length > 2) {
					let expectedName = c[2]
					assertEqual(expected, scope[expectedName]);
				}
			}.bind(null, c));
		}
	});
}

function assertEqual(expected, actual) {
	if (typeof expected === 'function') {
		assert.equal('function', typeof actual);
	} else {
		assert.deepEqual(expected, actual);
	}
}
