function processPayment(req, res) {
  const { amount, method } = req.body;

  if (!amount || !method) {
    return res.status(400).json({ message: 'Amount and payment method are required' });
  }

  const isSuccess = Math.random() < 0.9;

  if (isSuccess) {
    return res.status(200).json({
      message: 'Payment successful',
      transactionId: 'TXN' + Date.now(),
      amount,
      method,
      status: 'success'
    });
  } else {
    return res.status(400).json({
      message: 'Payment failed',
      status: 'failed'
    });
  }
}

module.exports = { processPayment };