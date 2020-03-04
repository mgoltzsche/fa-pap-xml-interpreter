const assert = require('assert');
const testee = require('../../src/expression/parser.js');

describe('expression', function() {
	describe('parse(exprStr)', function() {
		let cases = [
			['123'],
			['-123'],
			['123.5'],
			['-123.5'],
			['my_var'],
			['my_var1'],
			['myvar.myval'],
			['VAR=123'],
			['VAR=x'],
			['VAR=o.myfn()'],
			['VAR={}'],
			['{}'],
			['{x,123.9,3}'],
			['{123.9,BigDecimal.valueOf(0.1)}'],
			['func()'],
			['func(753.9)'],
			['a(b(753))'],
			['o.call(123)'],
			['o.call(123)(x).sum'],
			['{x}.sublist(1)'],
			['new BigDecimal(123.5)'],
			['new BigDecimal(123.5).add(7.1)'],
			['myvar[0]'],
			['myfn()[0]'],
			['{a,b}[0]'],
			['x[0]=a'],
			['x==y'],
			['3==7'],
			['3==y'],
			['x==7'],
			['x!=y'],
			['3!=7'],
			['3!=y'],
			['x!=7'],
			['x<y'],
			['3<7'],
			['3>y'],
			['x>7'],
			['x<=7'],
			['x>=7'],
			['x+y'],
			['3+7'],
			['x+7'],
			['3+y'],
			['x-y'],
			['3-7'],
			['x-7'],
			['3-y'],
			['3--7'],
			['3+-7'],
			['(3+7)', '3+7'],
			['x+3-7', 'x+3-7'],
			['x+(3-7)', 'x+(3-7)'],
			['x-(3+7)', 'x-(3+7)'],
			['x*3', 'x*3'],
			['x+y*3', 'x+(y*3)'],
			['x/3', 'x/3'],
			['x+y/3', 'x+(y/3)'],
			['x=3+7', 'x=(3+7)'],
			['x<3+7', 'x<(3+7)'],
			['x>3+7', 'x>(3+7)'],
			['x!=3+7', 'x!=(3+7)'],
			['x==3+7', 'x==(3+7)'],
			['x+5==3+7', 'x+5==(3+7)'],
			['x=3+(55-7)', 'x=(3+(55-7))'],
			['x=fn()+b', 'x=(fn()+b)'],
			['x=3+call(y)-7+3', 'x=(3+call(y)-7+3)'],
			['a&&b&&c'],
			['a&&b||c'],
			['a()&&b()||c()'],
			['a||b&&c', 'a||(b&&c)'],
			['a&&b==c', 'a&&(b==c)'],
			['a||b==c', 'a||(b==c)'],
			['a&&b||c', 'a&&b||c'],
			['a||b==c+3-x', 'a||(b==(c+3-x))'],
		];
		for (let c of cases) {
			let input = c[0];
			let expected = expectedExpr(c);
			it(`should parse "${input}" to ${expected}`, function(input, expected) {
				assert.equal(testee.parse(input).toString(), expected);
			}.bind(null, input, expected));
		}
		for (let c of cases) {
			let whExpr = ' ' + c[0].replace(/==|!=|<=|>=|&&|\|\||[^a-z_0-9\.\- ]|[a-z_ ]+\.|\.[a-z_ ]+|[a-z0-9]+-/ig, ' $& ') + ' ';
			let expected = expectedExpr(c);
			it(`should parse (with ws) "${whExpr}" to ${expected}`, function(c, whExpr, expected) {
				assert.equal(testee.parse(whExpr).toString(), expected);
			}.bind(null, c, whExpr, expected));
		}
		let invalid = [
			'',
			' ',
			'-',
			'- ',
			' - ',
			'+',
			'<',
			'>',
			'0.0.0',
			'.',
			'.key',
			'o.',
			'{',
			'{.}',
			'{,}',
			'[',
			']',
			'}',
			'(',
			'()',
			'func(',
			'func(3',
			')',
			'func)',
			'func()x',
			'o.myfn(',
			'fn()=x',
			'3()',
			'3=x',
			'3=5',
			'x=',
			'x==',
			'x!',
			'x!=',
			'x<=',
			'x>=',
			'x+',
			'x-',
			'x&',
			'x|',
			'x x',
		];
		for (let expr of invalid) {
			it('should reject ' + expr, function(expr) {
				let result;
				try {
					result = testee.parse(expr);
				} catch(e) {
					if (e instanceof testee.ParserError) {
						return; // expected
					}
					throw e;
				}
				assert.fail('Unexpectedly succeeded and returned: ' + result.toString());
			}.bind(null, expr))
		}
	});
});

function expectedExpr(c) {
	return c.length > 1 ? c[1] : c[0];
}
