import './style.scss';
import Lohnsteuer2020 from './codes/Lohnsteuer2020.xml.xhtml';
import load from './faxmlinterpreter/loader.js';

console.log(Lohnsteuer2020);
document.body.innerHTML = "hello <pre>" + Lohnsteuer2020 + "</pre>";

load(Lohnsteuer2020, function(result) {
	console.log(result);
}, function(err) {
	console.log(err);
});
