const service = require('./reportes.service');

exports.getReportCashRegister = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.params;
    const negocio_id = req.user.negocio_id; // 👈 importante si trabajas multi negocio

    if (!fechaDesde || !fechaHasta) {
      return res.status(400).json({ message: 'Fechas requeridas' });
    }

    const data = await service.getReportCashRegister(
      fechaDesde,
      fechaHasta,
      negocio_id
    );

    res.json(data);
  } catch (error) {
    console.error('Error en reporte de caja:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// ==============================
// reportes.controller.js
// ==============================



exports.getReportDashboard = async (req, res) => {
  try {
    const { ano } = req.params
    const data = await service.getReportDashboard(ano)
    res.status(200).json(data)

  } catch (error) {
    console.log(error)
    res.status(500).json({
      error: error.message || 'Error al obtener dashboard'
    })
  }
}