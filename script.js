let currentMode = 'have';
let lastSummary = '';

const comparisonWidths = [115, 120, 140, 150, 160, 180, 250, 300];

const tabs = document.querySelectorAll('.tab');
const form = document.querySelector('#calculatorForm');
const quantityGroup = document.querySelector('#quantityGroup');
const fabricLengthGroup = document.querySelector('#fabricLengthGroup');
const resultLeadEl = document.querySelector('#resultLead');
const resultsEl = document.querySelector('#results');
const alertsEl = document.querySelector('#alerts');
const summaryEl = document.querySelector('#summary');
const previewEl = document.querySelector('#layoutPreview');
const comparisonEl = document.querySelector('#widthComparison');
const copyButton = document.querySelector('#copyButton');
const clearButton = document.querySelector('#clearButton');

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const meterFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function getNumber(id) {
  const element = document.querySelector(id);
  const normalizedValue = element.value.replace?.(',', '.') || element.value;
  const value = Number(normalizedValue);
  return Number.isFinite(value) ? value : 0;
}

function formatCm(value) {
  return `${decimalFormatter.format(round(value))} cm`;
}

function formatMeters(valueCm) {
  return `${meterFormatter.format(round(valueCm / 100))} m`;
}

function formatPieceMeasure(width, length) {
  return `${decimalFormatter.format(round(width))} x ${decimalFormatter.format(round(length))} cm`;
}

function formatSuggestedLength(valueCm) {
  return valueCm < 100 ? formatCm(valueCm) : formatMeters(valueCm);
}

function formatSuggestedLengthDetail(valueCm) {
  return valueCm < 100 ? formatCm(valueCm) : `${formatCm(valueCm)} / ${formatMeters(valueCm)}`;
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
    pricePerMeter: getNumber('#pricePerMeter'),
    fabricPrice: getNumber('#fabricPrice'),
    boughtLength: getNumber('#boughtLength'),
    allowRotate: document.querySelector('#allowRotate').checked
  };
}

const {
  calculateHaveFabric,
  calculateBuyFabric,
  compareFabricWidths
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
  const maxPreviewPieces = 60;
  const piecesToRender = Math.min(totalPieces, maxPreviewPieces);
  const omittedPieces = totalPieces - piecesToRender;

  let pieces = '';
  for (let index = 0; index < piecesToRender; index += 1) {
    pieces += `<span class="preview-piece" title="Peça ${index + 1}">${index + 1}</span>`;
  }

  previewEl.innerHTML = `
    <div class="layout-preview">
      <h3>Visualização aproximada do encaixe</h3>
      <p>${result.piecesAcross} peça(s) por faixa em ${rows} fileira(s).</p>
      ${result.rotated ? '<p>Visualização com a peça girada.</p>' : ''}
      <div class="fabric-preview" style="--pieces-across: ${result.piecesAcross};">
        ${pieces}
      </div>
      ${omittedPieces > 0 ? `<p class="preview-note">+ ${omittedPieces} peça(s) não exibidas para manter a visualização simples.</p>` : ''}
    </div>
  `;
}

function renderWidthComparison(input) {
  const comparisons = compareFabricWidths(input, comparisonWidths);
  const rows = comparisons.map(item => {
    if (!item.fits) {
      return `
        <tr>
          <td>${formatCm(item.width)}</td>
          <td colspan="4">Não cabe</td>
        </tr>
      `;
    }

    return `
      <tr class="${item.isBest ? 'best-option' : ''}">
        <td>${formatCm(item.width)}</td>
        <td>${item.piecesAcross}</td>
        <td>${item.rowsNeeded}</td>
        <td>${formatMeters(item.neededLength)}</td>
        <td>
          ${formatSuggestedLength(item.suggestedLength)}
          ${item.isBest ? '<span class="best-badge">Melhor aproveitamento</span>' : ''}
        </td>
      </tr>
    `;
  }).join('');

  comparisonEl.innerHTML = `
    <section class="width-comparison">
      <h3>Comparar larguras de tecido</h3>
      <p>Veja qual largura pode render melhor para esta compra.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Largura</th>
              <th>Peças por faixa</th>
              <th>Fileiras</th>
              <th>Necessário</th>
              <th>Sugestão</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHaveResults(input, result) {
  if (result.piecesAcross <= 0 || result.totalPieces <= 0) {
    resultLeadEl.textContent = 'Com essas medidas, essa peça não cabe neste tecido. Tente girar a peça ou ajustar as medidas.';
    resultsEl.innerHTML = '';
    comparisonEl.innerHTML = '';
    lastSummary = `✂️ Resumo do corte\n\nEssa peça não coube no tecido informado. Tente girar a peça ou conferir as medidas.\n`;
    return;
  }

  resultLeadEl.innerHTML = `Com essas medidas, cabem <strong>${result.totalPieces} peça(s)</strong> neste tecido.`;

  const costItems = result.pricePerMeter > 0 ? [
    renderResultItem(moneyFormatter.format(result.pricePerMeter), 'Custo por metro linear'),
    renderResultItem(moneyFormatter.format(result.costPerPiece), 'Custo por peça')
  ].join('') : '';

  resultsEl.innerHTML = [
    renderResultItem(result.totalPieces, 'Peças que cabem'),
    renderResultItem(result.piecesAcross, 'Peças por faixa/largura'),
    renderResultItem(result.rowsInLength, 'Fileiras no comprimento'),
    renderResultItem(formatCm(result.usedLength), 'Comprimento usado'),
    renderResultItem(formatCm(Math.max(result.remainingLength, 0)), 'Sobra de tecido'),
    costItems
  ].join('');

  comparisonEl.innerHTML = '';

  lastSummary = `✂️ Resumo do corte\n\n` +
    `Tecido: ${formatCm(input.fabricWidth)} de largura\n` +
    `Comprimento disponível: ${formatCm(input.fabricLength)}\n` +
    `Peça: ${formatPieceMeasure(input.pieceWidth, input.pieceLength)}\n` +
    `Margem: ${formatCm(input.margin)}\n` +
    `Espaço entre peças: ${formatCm(input.spacing)}\n` +
    `Encaixe: ${result.rotated ? 'peça girada' : 'peça normal'}\n\n` +
    `Resultado:\n` +
    `Cabem ${result.totalPieces} peças no tecido.\n` +
    `Peças por faixa: ${result.piecesAcross}\n` +
    `Fileiras: ${result.rowsInLength}\n` +
    `Comprimento usado: ${formatCm(result.usedLength)}\n` +
    `Sobra: ${formatCm(Math.max(result.remainingLength, 0))}\n` +
    (result.pricePerMeter > 0 ? `Custo por peça: ${moneyFormatter.format(result.costPerPiece)}\n` : '');
}

function renderBuyResults(input, result) {
  if (result.piecesAcross <= 0) {
    resultLeadEl.textContent = 'Nesta largura de tecido, essa peça não cabe. Veja abaixo se outra largura funciona melhor.';
    resultsEl.innerHTML = '';
    renderWidthComparison(input);
    lastSummary = `🧵 Resumo da compra\n\nEssa peça não coube na largura de ${formatCm(input.fabricWidth)}. Tente girar a peça ou comparar com tecidos mais largos.\n`;
    return;
  }

  resultLeadEl.innerHTML = `Para fazer <strong>${input.desiredQuantity} peça(s)</strong>, você precisa comprar aproximadamente <strong>${formatMeters(result.neededLength)}</strong> de tecido.<p class="buy-suggestion">Sugestão para comprar com segurança: <strong>${formatSuggestedLength(result.suggestedLength)}</strong>.</p>`;

  const costItems = result.pricePerMeter > 0 ? [
    renderResultItem(moneyFormatter.format(result.pricePerMeter), 'Custo por metro linear'),
    renderResultItem(moneyFormatter.format(result.costPerPiece), 'Custo por peça'),
    renderResultItem(moneyFormatter.format(result.totalCost), 'Custo estimado da produção')
  ].join('') : '';

  resultsEl.innerHTML = [
    renderResultItem(formatCm(result.neededLength), 'Comprimento necessário'),
    renderResultItem(formatMeters(result.neededLength), 'Comprar em metros'),
    renderResultItem(formatSuggestedLengthDetail(result.suggestedLength), 'Sugestão para comprar com segurança'),
    renderResultItem(result.piecesAcross, 'Peças por faixa/largura'),
    renderResultItem(result.rowsNeeded, 'Fileiras necessárias'),
    costItems
  ].join('');

  renderWidthComparison(input);

  lastSummary = `🧵 Resumo da compra\n\n` +
    `Tecido: ${formatCm(input.fabricWidth)} de largura\n` +
    `Peça: ${formatPieceMeasure(input.pieceWidth, input.pieceLength)}\n` +
    `Quantidade desejada: ${input.desiredQuantity} peças\n` +
    `Margem: ${formatCm(input.margin)}\n` +
    `Espaço entre peças: ${formatCm(input.spacing)}\n` +
    `Encaixe: ${result.rotated ? 'peça girada' : 'peça normal'}\n\n` +
    `Resultado:\n` +
    `Você precisa de ${formatMeters(result.neededLength)} de tecido.\n` +
    `Sugestão de compra: ${formatSuggestedLength(result.suggestedLength)}\n` +
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

function clearRenderedResults(message) {
  resultLeadEl.innerHTML = '';
  resultsEl.innerHTML = '';
  previewEl.innerHTML = '';
  comparisonEl.innerHTML = '';
  summaryEl.textContent = message;
  copyButton.classList.add('hidden');
}

function calculate() {
  const input = getInputs();
  const errors = validateInputs(input);

  if (errors.length > 0) {
    renderAlerts(errors.map(text => ({ type: 'danger', text })));
    clearRenderedResults('Corrija as medidas para calcular.');
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
  document.querySelector('#pricePerMeter').value = '';
  document.querySelector('#fabricPrice').value = '';
  document.querySelector('#boughtLength').value = '';
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
