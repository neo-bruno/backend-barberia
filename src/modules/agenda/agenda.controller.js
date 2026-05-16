const service = require('./agenda.service');

exports.getAgendaSlots=async(req,res,next)=>{
 try{

  const negocioId=req.user.negocio_id
  const fecha=req.params.fecha

  const data=await service.getAgendaSlots(negocioId, fecha)

  res.json(data)

 }catch(error){
   next(error)
 }

}

exports.getAgendaPublic = async (req, res) => {
  try {
    const { slug, fecha } = req.params
    const agenda = await service.getAgendaPublic({slug,fecha})

    return res.json(agenda)
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: 'Error al obtener horarios'
    })
  }
}