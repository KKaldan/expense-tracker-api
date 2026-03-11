// Before
router.get('/expenses', async (req, res, next) => {
  try {
    const data = await expenseService.list(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err); // easy to forget
  }
});

// After
router.get('/expenses', asyncHandler(async (req, res) => {
  const data = await expenseService.list(req.user.id);
  res.json({ success: true, data });
}));