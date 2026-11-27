import './style.css';

const status = document.querySelector<HTMLParagraphElement>('#status');
if (status) {
  status.textContent = 'Loading prices…';
}
