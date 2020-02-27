import load from '../src/faxmlinterpreter/loader.js';
import fs from 'fs';
import assert from 'assert';

describe('FA XML Interpreter', function() {
	describe('load(xmlStr)', function() {
		it('load', function() {
			let Lohnsteuer2020 = fs.readFileSync('src/codes/Lohnsteuer2020.xml.xhtml', 'utf8');

			load(Lohnsteuer2020, function(result) {
				assert(result);
				// TODO: evaluate all and assert
			}, function(err) {
				throw err;
			});
		});
	});
});
