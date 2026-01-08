document.getElementById('regForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    username: form.username_ex.value,
    name: form.name.value
  };

  const messageEl = document.getElementById('message');
  messageEl.textContent = 'Sending...';
  messageEl.className = '';

  try {
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const json = await res.json();
    const msg = json.message || (json.success ? 'Success' : 'Error');
    messageEl.textContent = msg;

    // Make the specific "username or password" message red, otherwise
    // show green for success and red for errors.
    if (msg && /username or password/i.test(msg)) {
      messageEl.className = 'error';
    } else if (json.success) {
      messageEl.className = 'success';
    } else {
      messageEl.className = 'error';
    }
  } catch (err) {
    messageEl.textContent = 'Network error';
    messageEl.className = 'error';
  }
});