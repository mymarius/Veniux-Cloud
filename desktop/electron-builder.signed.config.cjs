// Production Windows distribution must use a verified publisher certificate.
// Private keys and passwords are supplied externally, never bundled in the app.
const base = require('./electron-builder.config.js');
const subject = process.env.VENIUX_SIGNING_SUBJECT;
const thumbprint = process.env.VENIUX_SIGNING_THUMBPRINT;
if (!process.env.CSC_LINK && !subject && !thumbprint) {
  throw new Error('İmzalı dağıtım için CSC_LINK veya Windows sertifika deposundaki VENIUX_SIGNING_SUBJECT / VENIUX_SIGNING_THUMBPRINT gerekli.');
}
module.exports = {
  ...base,
  forceCodeSigning: true,
  win: {
    ...base.win,
    signAndEditExecutable: true,
    signExecutable: true,
    signtoolOptions: {
      signingHashAlgorithms: ['sha256'],
      rfc3161TimeStampServer: 'http://timestamp.digicert.com',
      ...(subject ? { certificateSubjectName: subject } : {}),
      ...(thumbprint ? { certificateSha1: thumbprint } : {})
    }
  }
};
