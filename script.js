let currentMode = 'have';
let lastSummary = '';

const tabs = document.querySelectorAll('.tab');
const form = document.querySelector('#calculatorForm');
const quantityGroup = document.querySelector('#quantityGroup');
const fabricLengthGroup = document.querySelector('#fabricLengthGroup');
const resultsEl = document.querySelector('#results');
const alertsEl = document.querySelector('#alerts');
const summaryEl = document.querySelector('#summary');
const previewEl = document.querySelector('#layoutPreview');
const copyButton = document.querySelector('#copyButton');
const clearButton = document.querySelector('#clearButton');

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function getNumber(id) {
  const value = Number(document.querySelector(id).value.replace?.(',', '.') || document.querySelector(id).value);
  return Number.isFinite(value) ? value : 0;
}

function formatCm(value) {
  return `${round(value)} cm`;
}

function formatMeters(valueCm) {
  return `${round(valueCm / 100)} m`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function getInputs() {
  return {
    fabricWidth: getNumber('#fabricWidth'),
    fabricLength: getNumber('#fabricLength'),
    pieceWidth: getNumber('#pieceWidth'),
    pieceLength: getNumber('#pieceLength'),
    margin: getNumber('#margin'),
    spacing: getNumber('#spacing'),
    desiredQuantity: Math.max(1, Math.floor(getNumber('#desiredQuantity'))),
    fabricPrice: getNumber('#fabricPrice'),
    boughtLength: getNumber('#boughtLength'),
    allowRotate: document.querySelector('#allowRotate').checked
  };
}

const {
  calculateHaveFabric,
  calculateBuyFabric
} = Calculator;
function renderResultItem(value, label) {
  return `
    <div class="result-item">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
}

function renderAlerts(alerts) {
  alertsEl.innerHTML = alerts.map(alert => `
    <div class="alert ${alert.type}">${alert.text}</div>
  `).join('');
}


function renderLayoutPreview(input, result) {
  if (result.piecesAcross <= 0) {
    previewEl.innerHTML = '';
    return;
  }

  const rows = currentMode === 'have' ? result.rowsInLength : result.rowsNeeded;
  const totalPieces = currentMode === 'have' ? result.totalPieces : input.desiredQuantity;
  const maxPreviewPieces = 180;
  const piecesToRender = Math.min(totalPieces, maxPreviewPieces);
  const omittedPieces = totalPieces - piecesToRender;

  let pieces = '';
  for (let index = 0; index < piecesToRender; index += 1) {
    pieces += `<span class="preview-piece" title="Peça ${index + 1}">${index + 1}</span>`;
  }

  previewEl.innerHTML = `
    <div class="layout-preview">
      <h3>Visualização do encaixe</h3>
      <p>${result.piecesAcross} peça(s) por faixa em ${rows} fileira(s).</p>
      <div class="fabric-preview" style="--pieces-across: ${result.piecesAcross};">
        ${pieces}
      </div>
      ${omittedPieces > 0 ? `<p class="preview-note">+ ${omittedPieces} peça(s) não exibidas para manter a visualização leve.</p>` : ''}
    </div>
  `;
}

function renderHaveResults(input, result) {
  const costItems = result.pricePerMeter > 0 ? [
    renderResultItem(moneyFormatter.format(result.pricePerMeter), 'Custo por metro linear'),
    renderResultItem(moneyFormatter.format(result.costPerPiece), 'Custo estimado por peça')
  ].join('') : '';

  resultsEl.innerHTML = [
    renderResultItem(result.totalPieces, 'Peças que cabem'),
    renderResultItem(result.piecesAcross, 'Peças por faixa/largura'),
    renderResultItem(result.rowsInLength, 'Fileiras no comprimento'),
    renderResultItem(formatCm(result.usedLength), 'Comprimento usado'),
    renderResultItem(formatCm(Math.max(result.remainingLength, 0)), 'Comprimento restante'),
    costItems
  ].join('');

  lastSummary = `Resumo do corte\n\n` +
    `Largura do tecido: ${formatCm(input.fabricWidth)}\n` +
    `Comprimento disponível: ${formatCm(input.fabricLength)}\n` +
    `Medida da peça: ${formatCm(input.pieceWidth)} x ${formatCm(input.pieceLength)}\n` +
    `Margem: ${formatCm(input.margin)}\n` +
    `Espaçamento: ${formatCm(input.spacing)}\n` +
    `Posição usada: ${result.rotated ? 'peça girada' : 'peça normal'}\n\n` +
    `Resultado:\n` +
    `Cabem ${result.totalPieces} peças no tecido.\n` +
    `Peças por faixa: ${result.piecesAcross}\n` +
    `Fileiras: ${result.rowsInLength}\n` +
    `Comprimento usado: ${formatCm(result.usedLength)} (${formatMeters(result.usedLength)})\n` +
    `Sobra de tecido: ${formatCm(Math.max(result.remainingLength, 0))}\n` +
    (result.pricePerMeter > 0 ? `Custo estimado por peça: ${moneyFormatter.format(result.costPerPiece)}\n` : '');
}

function renderBuyResults(input, result) {
  const costItems = result.pricePerMeter > 0 ? [
    renderResultItem(moneyFormatter.format(result.pricePerMeter), 'Custo por metro linear'),
    renderResultItem(moneyFormatter.format(result.costPerPiece), 'Custo estimado por peça'),
    renderResultItem(moneyFormatter.format(result.totalCost), 'Custo estimado da produção')
  ].join('') : '';

  resultsEl.innerHTML = [
    renderResultItem(formatCm(result.neededLength), 'Comprimento necessário'),
    renderResultItem(formatMeters(result.neededLength), 'Comprar em metros'),
    renderResultItem(result.piecesAcross, 'Peças por faixa/largura'),
    renderResultItem(result.rowsNeeded, 'Fileiras necessárias'),
    costItems
  ].join('');

  lastSummary = `Resumo da compra\n\n` +
    `Largura do tecido: ${formatCm(input.fabricWidth)}\n` +
    `Medida da peça: ${formatCm(input.pieceWidth)} x ${formatCm(input.pieceLength)}\n` +
    `Quantidade desejada: ${input.desiredQuantity} peças\n` +
    `Margem: ${formatCm(input.margin)}\n` +
    `Espaçamento: ${formatCm(input.spacing)}\n` +
    `Posição usada: ${result.rotated ? 'peça girada' : 'peça normal'}\n\n` +
    `Resultado:\n` +
    `Você precisa comprar aproximadamente ${formatMeters(result.neededLength)} de tecido.\n` +
    `Comprimento em cm: ${formatCm(result.neededLength)}\n` +
    `Peças por faixa: ${result.piecesAcross}\n` +
    `Fileiras necessárias: ${result.rowsNeeded}\n` +
    (result.pricePerMeter > 0 ? `Custo estimado da produção: ${moneyFormatter.format(result.totalCost)}\n` : '');
}

function validateInputs(input) {
  const errors = [];

  if (input.fabricWidth <= 0) errors.push('Informe a largura do tecido.');
  if (currentMode === 'have' && input.fabricLength <= 0) errors.push('Informe o comprimento disponível do tecido.');
  if (input.pieceWidth <= 0) errors.push('Informe a largura da peça.');
  if (input.pieceLength <= 0) errors.push('Informe o comprimento da peça.');
  if (input.margin < 0) errors.push('Informe uma margem de costura igual ou maior que zero.');
  if (input.spacing < 0) errors.push('Informe um espaço entre peças igual ou maior que zero.');
  if (currentMode === 'buy' && input.desiredQuantity <= 0) errors.push('Informe a quantidade desejada.');

  return errors;
}

function calculate() {
  const input = getInputs();
  const errors = validateInputs(input);

  if (errors.length > 0) {
    renderAlerts(errors.map(text => ({ type: 'danger', text })));
    resultsEl.innerHTML = '';
    previewEl.innerHTML = '';
    summaryEl.textContent = 'Corrija as medidas para calcular.';
    copyButton.classList.add('hidden');
    return;
  }

  if (currentMode === 'have') {
    const result = calculateHaveFabric(input);
    renderAlerts(result.alerts);
    renderHaveResults(input, result);
    renderLayoutPreview(input, result);
  } else {
    const result = calculateBuyFabric(input);
    renderAlerts(result.alerts);
    renderBuyResults(input, result);
    renderLayoutPreview(input, result);
  }

  summaryEl.textContent = lastSummary;
  copyButton.classList.remove('hidden');
}

function setMode(mode) {
  currentMode = mode;
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
  quantityGroup.classList.toggle('hidden', mode !== 'buy');
  fabricLengthGroup.classList.toggle('hidden', mode !== 'have');
  calculate();
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

document.querySelectorAll('.preset-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelector('#fabricWidth').value = button.dataset.width;
    calculate();
  });
});

form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});

form.addEventListener('input', () => {
  calculate();
});

clearButton.addEventListener('click', () => {
  form.reset();
  document.querySelector('#fabricWidth').value = 150;
  document.querySelector('#fabricLength').value = 200;
  document.querySelector('#pieceWidth').value = 20;
  document.querySelector('#pieceLength').value = 30;
  document.querySelector('#margin').value = 1;
  document.querySelector('#spacing').value = 1;
  document.querySelector('#desiredQuantity').value = 50;
  document.querySelector('#allowRotate').checked = true;
  calculate();
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastSummary);
    copyButton.textContent = 'Resumo copiado!';
    setTimeout(() => {
      copyButton.textContent = 'Copiar resumo';
    }, 1800);
  } catch (error) {
    alert('Não foi possível copiar automaticamente. Selecione o resumo e copie manualmente.');
  }
});

calculate();
