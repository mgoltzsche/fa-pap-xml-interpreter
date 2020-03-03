import {load, BigDecimal} from '../../src/fa-pap-xml/pap.js';
import fs from 'fs';
import assert from 'assert';
import BigNumber from 'bignumber.js';

describe('FA PAP XML Interpreter', function() {
	describe('load(xmlStr)', function() {
		it('load', function() {
			let Lohnsteuer2020 = fs.readFileSync('src/codes/Lohnsteuer2020.xml.xhtml', 'utf8');
			let pap = load(Lohnsteuer2020);
			assert(pap, 'pap');

			let inputs = pap.inputs();
			assert.ok(inputs.filter(n => n.name === 'KRV').length === 1, 'input var "KRV" should be among INPUT names');
			assert.ok(inputs.filter(n => n.name === 'TAB1').length === 0, 'internal var "TAB1" should not be among INPUT names');

			let outputs = pap.outputs();
			assert.ok(outputs.filter(n => n.name === 'LSTLZZ').length === 1, 'output var "LSTLZZ" should be among OUTPUT names');
			assert.ok(outputs.filter(n => n.name === 'VFRB').length === 1, 'output var "VFRB" should be among OUTPUT names');
			assert.ok(outputs.filter(n => n.name === 'KRV').length === 0, 'INPUT var "KRV" should not be among OUTPUT names');

			let inputTypeMap = {
				BigDecimal: i => new BigDecimal(new BigNumber(i + 100)),
				int: i => new BigNumber(i + 10),
				double: i => new BigNumber(i + 0.5),
			}
			let inputParams = inputs.reduce((r,n,i) => {
				let inputGen = inputTypeMap[n.type];
				if (!inputGen) {
					throw new Error(`Unsupported var type ${n.type}`);
				}
				r[n.name] = inputGen(i);
				return r;
			}, {});
			let evaluated = pap.evaluate(inputParams);
			assert(evaluated, 'evaluated');
		});
	});
});
