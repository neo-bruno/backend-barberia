const pool = require('../../config/db')

exports.createBlockade = async ({
  negocioId,
  fecha,
  hora_inicio,
  hora_fin,
  motivo,
  tipo
}) => {

  const client = await pool.connect()

  try {

    await client.query('BEGIN')

    // crear bloqueo
    const blockadeResult = await client.query(
      `
      INSERT INTO public.bloqueos(
	      negocio_id, 
        fecha, 
        hora_inicio, 
        hora_fin, 
        motivo, 
        tipo
        )        
	      VALUES 
        ($1, $2, $3, $4, $5, $6) RETURNING *;      
      `,
      [
        negocioId,
        fecha,
        hora_inicio,
        hora_fin,
        motivo || null,
        tipo || 'manual'
      ]
    )

    await client.query('COMMIT')
    return blockadeResult.rows[0]

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

exports.deleteBlockade = async (
 id,
 negocioId
) => {

  const result = await pool.query(
   `
   DELETE FROM bloqueos
   WHERE id=$1
   AND negocio_id=$2
   `,
   [id, negocioId]
  )

  if(result.rowCount===0){
    throw new Error('Bloqueo no encontrado')
  }

}