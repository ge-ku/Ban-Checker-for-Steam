const tables = document.querySelectorAll('table');
let csrTable;
for (const table of tables) {
  const tableHeaders = table.querySelectorAll('th');
  for (const th of tableHeaders) {
    if (th.textContent === 'Updated') {
      csrTable = table;
    }
  }
}

if (csrTable) {
  const csrTh = document.createElement('th');
  csrTh.textContent = 'CS Rating';
  csrTable.querySelector('tr').append(csrTh);

  const premierRows = [...csrTable.querySelectorAll('tr')]
    .filter(tr => tr.querySelector('td')?.textContent.startsWith('premier'))
    .reverse();
  let prevScore = 0;

  for (const row of premierRows) {
    const score = Number(row.querySelector('td:last-of-type').textContent);
    const csr = score >> 15;

    const csrTd = document.createElement('td');

    const csrSpan = document.createElement('span');
    csrSpan.textContent = csr;
    csrTd.append(csrSpan);

    if (prevScore) {
      const csrDiffSpan = document.createElement('span');
      const diff = csr - prevScore;
      csrDiffSpan.textContent = `(${diff > 0 ? '+' : ''}${diff})`;
      csrDiffSpan.style.marginLeft = '1em';
      if (diff < 0) {
        csrDiffSpan.style.color = 'red';
      } else {
        csrDiffSpan.style.color = 'green';
      }
      csrTd.append(csrDiffSpan);
    }

    row.append(csrTd);
    prevScore = csr;
  }
}
