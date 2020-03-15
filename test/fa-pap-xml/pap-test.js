import {loadPAP} from '../../src/fa-pap-xml/pap.js';
import fs from 'fs';
import assert from 'assert';
import BigNumber from 'bignumber.js';

describe('FA PAP XML Interpreter', function() {
	describe('load(xmlStr)...evaluate(input)', function() {
		it('load', function() {
			let Lohnsteuer2020 = fs.readFileSync('src/codes/Lohnsteuer2020.xml.xhtml', 'utf8');

			// Load PAP
			let pap = loadPAP(Lohnsteuer2020);
			assert(pap, 'pap');

			// Assert inputs
			let inputs = pap.inputs();
			let inputVars = inputs.vars;
			assert.ok(inputVars.filter(n => n.name === 'KRV').length === 1, 'input var "KRV" should be among INPUT names');
			assert.ok(inputVars.filter(n => n.name === 'TAB1').length === 0, 'internal var "TAB1" should not be among INPUT names');
			assert.ok(inputVars.filter(n => n.comment).length > 0, 'at least one input var should have a comment');

			// Assert outputs
			let outputs = pap.outputs();
			let outputVars = outputs.vars;
			assert.ok(outputVars.filter(n => n.name === 'LSTLZZ').length === 1, 'output var "LSTLZZ" should be among OUTPUT names');
			assert.ok(outputVars.filter(n => n.name === 'VFRB').length === 1, 'output var "VFRB" should be among OUTPUT names');
			assert.ok(outputVars.filter(n => n.name === 'KRV').length === 0, 'INPUT var "KRV" should not be among OUTPUT names');
			assert.ok(outputVars.filter(n => n.comment).length > 0, 'at least one output var should have a comment');

			// Assert input defaults
			let defaults = pap.defaults();
			assert(Object.keys(defaults).length > 0, '#defaults()');

			// Assert input conversion
			let rawInputValues = {};
			for (let i = 0; i < inputVars.length; i++) {
				rawInputValues[inputVars[i].name] = i + 100;
			}
			let inputValues = inputs.createValues(rawInputValues);
			let expectedInputNames = inputVars.map(v => v.name);
			let actualInputNames = Object.keys(inputValues);
			expectedInputNames.sort();
			actualInputNames.sort();
			assert.equal(expectedInputNames.join(','), actualInputNames.join(','), 'converted input names names');
			for (let [k,v] of Object.entries(inputValues)) {
				assert.equal(''+rawInputValues[k], ''+v, `#createValues()[${k}]`);
			}

			// Evaluate
			let evaluated = pap.evaluate(inputValues);
			assert(evaluated, 'evaluated');

			// Assert actual outputs are not empty and names equal expected
			let expectedOutputNames = outputVars.map(i => i.name);
			let actualOutputNames = Object.keys(evaluated);
			expectedOutputNames.sort();
			actualOutputNames.sort();
			assert.equal(expectedOutputNames.join(','), actualOutputNames.join(','), 'output names');
			for (let [k,v] of Object.entries(evaluated)) {
				assert(v, `output ${k} should not be empty`);
			}
		});
	});

	describe('load(pap2020).evaluate({...}) (real scenario)', function() {
		it('scenario', function() {
			let Lohnsteuer2020 = fs.readFileSync('src/codes/Lohnsteuer2020.xml.xhtml', 'utf8');
			let pap = loadPAP(Lohnsteuer2020);
			assert(pap, 'pap');
			let inputDecl = pap.inputs();
			let input = {
				af: 0,
				STKL: 1,
				//JFREIB: 0,
				//JHINZU: 0,
				//JRE4: '6000000',
				//JVBEZ: 0,
				RE4: '6000000',
				KRV: 1,
				KVZ: '0.7',

				LZZ: 1,
				LZZFREIB: 0,
				LZZHINZU: 0,

				R: 0,
				VBEZ: 0,
				ZMVB: 0,
				ZKF: 0,
				ALTER1: 0,
				SONSTB: 0,
				VKAPA: 0,
				VMT: 0,
			};
			let output = pap.evaluate(inputDecl.createValues(input));
			assert.equal('1194900', ''+output['LSTLZZ'], 'resulting tax wage cent')
			assert.equal('65719', ''+output['SOLZLZZ'], 'resulting solidarity commission cent')
		});
	});
});
