import './style.scss';
import Lohnsteuer2020 from './codes/Lohnsteuer2020.xml.xhtml';
import {load} from './fa-pap-xml/pap.js';

console.log(Lohnsteuer2020);
let body = document.body;

function text(txt) {
	let div = document.createElement('div');
	div.appendChild(document.createTextNode(txt));
	body.appendChild(div);
}

let pap = load(Lohnsteuer2020);
let defaults = pap.defaults();
let inputs = pap.inputs();
let outputs = pap.outputs();

let inputFields = {};
let outputFields = {};

function inputValues() {
	let values = {};
	for (let [k,v] of Object.entries(inputFields)) {
		values[k] = v.value;
	}
	return values;
}

function calculate() {
	let output = pap.evaluate(inputs.createValues(inputValues()));
	for (let [k,v] of Object.entries(outputFields)) {
		v.value = '' + output[k];
	}
}

let form = document.createElement('form');
let button = document.appendChild('button');
form.appendChild(button);
button.innerHTML = 'Berechnen';
button.onClick = _ => {calculate(); return false;};

text('PAP');
text('INPUTS:');
body.appendChild(form);

function addInput(input, value) {
	let div = document.createElement('div');
	let label = document.createElement('label');
	let field = document.createElement('input');
	label.text = input.name;
	field.type = 'text';
	div.appendChild(label);
	div.appendChild(field);
	form.appendChild(div);
	inputFields[input.name] = field;
}

function addOutput(output) {
	let div = document.createElement('div');
	let label = document.createElement('label');
	let field = document.createElement('input');
	label.text = output.name;
	field.type = 'text';
	field.readOnly = true;
	div.appendChild(label);
	div.appendChild(field);
	form.appendChild(div);
	outputFields[name] = output;
}

for (let input of inputs) {
	let defaultValue = defaults[input.name];
	if (defaultValue === undefined || defaultValue === null) {
		defaultValue = '';
	}
	addInput(input.name, '' + defaultValue);
}

text('OUTPUTS:');

for (let output of outputs) {
	addOutput(output);
}
