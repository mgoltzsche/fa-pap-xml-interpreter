const assert = require('assert');
const testee = require('../../src/expression/parser.js');

describe('expression', function() {
	describe('parse(exprStr)', function() {
		let cases = [
			'123',
			'-123',
			'123.5',
			'-123.5',
			'my_var',
			'my_var1',
			'myvar.myval',
			'VAR=123',
			'VAR=x',
			'VAR=o.myfn()',
			'VAR={}',
			'{}',
			'{x,123.9,3}',
			'{123.9,BigDecimal.valueOf(0.1)}',
			'func()',
			'func(753.9)',
			'a(b(753))',
			'o.call(123)',
			'o.call(123)(x).sum',
			'{x}.sublist(1)',
			'new BigDecimal(123.5)',
			'new BigDecimal(123.5).add(7.1)',
			'x==y',
			'3==7',
			'3==y',
			'x==7',
			'x!=y',
			'3!=7',
			'3!=y',
			'x!=7',
			'x<y',
			'3<7',
			'3>y',
			'x>7',
			'x+y',
			'3+7',
			'x+7',
			'3+y',
			'x-y',
			'3-7',
			'x-7',
			'3-y',
			'3--7',
			'3+-7',
			'(3+7)',
		];
		for (let expr of cases) {
			it('should parse: ' + expr, function(expr) {
				assert.equal(testee.parse(expr).toString(), expr);
			}.bind(null, expr));
		}
		for (let expr of cases) {
			let whExpr = ' ' + expr.replace(/[^a-z_0-9\. ]|[a-z_ ]+\.|\.[a-z_ ]+/ig, ' $& ') + ' ';
			it('should parse wh: ' + whExpr, function(expr, whExpr) {
				assert.equal(testee.parse(whExpr).toString(), expr);
			}.bind(null, expr, whExpr))
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
		];
		for (let expr of invalid) {
			it('should reject: ' + expr, function(expr) {
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
