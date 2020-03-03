import './style.scss';
import Lohnsteuer2020 from './codes/Lohnsteuer2020.xml.xhtml';
import {load} from './fa-pap-xml/pap.js';

console.log(Lohnsteuer2020);
document.body.innerHTML = "hello <pre>" + Lohnsteuer2020 + "</pre>";

let pap = load(Lohnsteuer2020);
