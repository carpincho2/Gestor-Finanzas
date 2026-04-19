export class ChartService {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.instance = null;
  }

  render(data, options = {}) {
    const ctx = document.getElementById(this.canvasId).getContext('2d');
    if (this.instance) this.instance.destroy();

    const config = {
      type: options.type || 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#8a94a6', font: { family: "'Outfit'", size: 11 }, boxWidth: 10, padding: 16 }
          },
          tooltip: {
            backgroundColor: '#131720',
            borderColor: '#232b3a',
            borderWidth: 1,
            titleColor: '#e8edf5',
            bodyColor: '#8a94a6',
            padding: 10,
            callbacks: {
              label: ctx => ` $${ctx.parsed.y.toLocaleString('es-AR')}`
            }
          }
        },
        scales: {
          x: { 
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, 
            ticks: { color: '#8a94a6', font: { family: "'JetBrains Mono'", size: 10 } } 
          },
          y: { 
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, 
            ticks: { 
              color: '#8a94a6', 
              font: { family: "'JetBrains Mono'", size: 10 }, 
              callback: v => '$' + v.toLocaleString('es-AR') 
            } 
          }
        },
        ...options.extraOptions
      }
    };

    this.instance = new Chart(ctx, config);
  }
}
