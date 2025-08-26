<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vault Dashboard</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #f8f9fa; }
    h2 { margin: 20px 0; }
    .badge { font-size: 0.9rem; }
  </style>
</head>
<body>

<div class="container mt-4">
  <h2 class="text-center">Vault</h2>

  <!-- Tabs -->
  <ul class="nav nav-tabs" id="vaultTabs" role="tablist">
    <li class="nav-item" role="presentation">
      <button class="nav-link active" id="files-tab" data-bs-toggle="tab" data-bs-target="#files" type="button" role="tab">Files</button>
    </li>
    <li class="nav-item" role="presentation">
      <button class="nav-link" id="links-tab" data-bs-toggle="tab" data-bs-target="#links" type="button" role="tab">Links</button>
    </li>
  </ul>

  <!-- Content -->
  <div class="tab-content mt-3" id="vaultTabsContent">

    <!-- Files -->
    <div class="tab-pane fade show active" id="files" role="tabpanel">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Recipient</th>
            <th>Date</th>
            <th>Hash</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="filesTable"></tbody>
      </table>
    </div>

    <!-- Links -->
    <div class="tab-pane fade" id="links" role="tabpanel">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>URL</th>
            <th>Recipient</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="linksTable"></tbody>
      </table>
    </div>

  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script>
// Fetch Files
fetch("/vault/files")
  .then(res => res.json())
  .then(files => {
    let rows = "";
    files.forEach(f => {
      rows += `
        <tr>
          <td>${f.name}</td>
          <td>${f.recipient}</td>
          <td>${new Date(f.date).toLocaleString()}</td>
          <td>${f.hash || '-'}</td>
          <td>
            <span class="badge ${f.status === 'safe' ? 'bg-success' : f.status === 'malicious' ? 'bg-danger' : 'bg-warning'}">
              ${f.status}
            </span>
          </td>
        </tr>
      `;
    });
    document.getElementById("filesTable").innerHTML = rows;
  });

// Fetch Links
fetch("/vault/links")
  .then(res => res.json())
  .then(links => {
    let rows = "";
    links.forEach(l => {
      rows += `
        <tr>
          <td><a href="${l.url}" target="_blank">${l.url}</a></td>
          <td>${l.recipient}</td>
          <td>${new Date(l.date).toLocaleString()}</td>
          <td>
            <span class="badge ${l.status === 'safe' ? 'bg-success' : l.status === 'malicious' ? 'bg-danger' : 'bg-warning'}">
              ${l.status}
            </span>
          </td>
        </tr>
      `;
    });
    document.getElementById("linksTable").innerHTML = rows;
  });
</script>

</body>
</html>
