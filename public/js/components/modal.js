export function showModal(content) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close">&times;</button>
      <div class="modal-content"></div>
    </div>
  `;
  overlay.querySelector('.modal-content').appendChild(
    typeof content === 'string' ? Object.assign(document.createElement('div'), { innerHTML: content }) : content
  );
  overlay.classList.remove('hidden');

  const close = () => overlay.classList.add('hidden');
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return { close };
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
