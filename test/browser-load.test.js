const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createClassList() {
  return {
    add() {},
    remove() {},
    toggle() {}
  };
}

function createElement(initial = {}) {
  return {
    value: '',
    checked: false,
    innerHTML: '',
    textContent: '',
    dataset: {},
    classList: createClassList(),
    addEventListener() {},
    reset() {},
    ...initial
  };
}

function createBrowserContext() {
  const elements = new Map();
  const ids = [
    'calculatorForm',
    'quantityGroup',
    'fabricLengthGroup',
    'resultLead',
    'results',
    'alerts',
    'summary',
    'layoutPreview',
    'widthComparison',
    'copyButton',
    'clearButton',
    'fabricWidth',
    'fabricLength',
    'pieceWidth',
    'pieceLength',
    'margin',
    'spacing',
    'desiredQuantity',
    'pricePerMeter',
    'fabricPrice',
    'boughtLength',
    'allowRotate',
    'projectModeSection',
    'simpleModeSection',
    'fabricSection',
    'pieceSection',
    'costSection',
    'sheetModeSection',
    'projectCutsList',
    'addProjectCutButton',
    'projectDetails',
    'projectDetailsContent',
    'resultPanelTitle',
    'projectFabricWidth',
    'projectPricePerMeter',
    'projectDefaultMargin',
    'projectDefaultSpacing',
    'projectAllowRotate',
    'projectName',
    'projectClient',
    'projectNotes',
    'sheetFabricWidth',
    'mattressType',
    'mattressWidth',
    'mattressLength',
    'mattressHeight',
    'underturnAllowance'
  ];

  ids.forEach(id => elements.set(`#${id}`, createElement()));
  elements.get('#calculatorForm').reset = () => {};
  elements.get('#fabricWidth').value = '150';
  elements.get('#fabricLength').value = '200';
  elements.get('#pieceWidth').value = '20';
  elements.get('#pieceLength').value = '30';
  elements.get('#margin').value = '1';
  elements.get('#spacing').value = '1';
  elements.get('#desiredQuantity').value = '50';
  elements.get('#allowRotate').checked = true;

  const tabs = [
    createElement({ dataset: { mode: 'project' } }),
    createElement({ dataset: { mode: 'simple' } }),
    createElement({ dataset: { mode: 'sheet' } })
  ];

  const simpleTabs = [
    createElement({ dataset: { simpleMode: 'have' } }),
    createElement({ dataset: { simpleMode: 'buy' } })
  ];

  return vm.createContext({
    __elements: elements,
    Intl,
    setTimeout,
    alert() {},
    navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
    document: {
      querySelector(selector) {
        return elements.get(selector) || createElement();
      },
      querySelectorAll(selector) {
        if (selector === '.tab') return tabs;
        if (selector === '.simple-tab') return simpleTabs;
        if (selector === '.preset-btn') return [];
        if (selector === '.project-preset-btn') return [];
        if (selector === '.sheet-preset-btn') return [];
        return [];
      }
    }
  });
}

test('browser scripts load together without redeclaring calculator functions', () => {
  const context = createBrowserContext();
  const calculatorSource = fs.readFileSync(path.join(__dirname, '..', 'calculator.js'), 'utf8');
  const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

  assert.doesNotThrow(() => {
    vm.runInContext(calculatorSource, context, { filename: 'calculator.js' });
    vm.runInContext(scriptSource, context, { filename: 'script.js' });
  });
  assert.equal(typeof context.Calculator.calculateHaveFabric, 'function');
  context.setMode('simple');
  context.setSimpleMode('have');
  assert.match(context.__elements.get('#resultLead').innerHTML, /Com essas medidas, cabem/);

  context.__elements.get('#pricePerMeter').value = '20';
  context.calculate();
  assert.match(context.__elements.get('#results').innerHTML, /R\$\s*20,00/);

  context.__elements.get('#pricePerMeter').value = '';
  context.__elements.get('#fabricPrice').value = '45';
  context.__elements.get('#boughtLength').value = '150';
  context.calculate();
  assert.match(context.__elements.get('#results').innerHTML, /R\$\s*30,00/);

  context.setSimpleMode('buy');
  assert.match(context.__elements.get('#resultLead').innerHTML, /Para fazer/);
  assert.match(context.__elements.get('#results').innerHTML, /Sugestão para comprar com segurança/);
  assert.match(context.__elements.get('#widthComparison').innerHTML, /Melhor aproveitamento/);
  assert.match(context.__elements.get('#summary').textContent, /🧵 Resumo da compra/);
});
