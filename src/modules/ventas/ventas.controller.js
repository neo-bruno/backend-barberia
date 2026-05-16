const ventasService = require('./ventas.service')

exports.getSales = async(req,res)=>{
 try{
   const negocioId = req.user.negocio_id
   const { fecha } = req.params

   if(!fecha){
     return res.status(400).json({
       error:'La fecha es requerida'
     })
   }
   const ventas = await ventasService.getSales({
      negocioId,
      fecha
    })
   return res.json(ventas)
 }catch(error){
   console.error(error)

   return res.status(500).json({
     error:'Error al obtener ventas'
   })
 }
}
exports.getSalesById = async (req, res) => {
  try {
    const negocioId = req.user.negocio_id;
    const { caja_id } = req.params;

    if (!caja_id) {
      return res.status(400).json({
        error: 'La caja es requerida'
      });
    }
    const ventas = await ventasService.getSalesById({ negocioId, cajaId: caja_id });
    return res.json(ventas);

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Error al obtener ventas de la caja'
    });
  }
};

// 🔹 CREAR VENTA (CON PROMOS)
exports.createVenta = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;

    const {
      cliente_id,
      reserva_id,
      monto,
      metodo_pago,
      monto_original // 🔥 importante
    } = req.body;

    if (!cliente_id || !monto || !metodo_pago || !monto_original) {
      return res.status(400).json({
        msg: 'Datos incompletos para la venta'
      });
    }

    const result = await ventasService.createVenta(
      {
        cliente_id,
        reserva_id,
        monto,
        metodo_pago,
        monto_original // 🔥 lo pasas al service
      },
      negocio_id
    );

    res.status(201).json({
      venta: result.venta,
      descuento: result.descuento,
      promocionesAplicadas: result.promos
    });

  } catch (error) {
    console.error('createVenta:', error);
    res.status(500).json({
      msg: 'Error al registrar la venta'
    });
  }
};