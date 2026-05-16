// RUTA DE IMAGENES
const express = require('express');
const router = express.Router();

const upload = require('../../middlewares/upload');
const controller = require('./images.controller')
const { verifyToken } = require('../auth/auth.middleware')

router.post( '/upload-logo', verifyToken, upload.single('imagen'), controller.uploadLogo );
router.post( '/upload-portada', verifyToken, upload.single('imagen'), controller.uploadPortada );
router.put( '/upload-galeria/:id', verifyToken, upload.single('imagen'), controller.uploadGaleria );

module.exports = router;