# CAMPUSSPHERE AI — PART 16/24
# DECIMAL SAFETY & EXACT INTEGER PAISE ARITHMETIC

## 1. The Floating-Point Arithmetic Dilemma

Standard IEEE 754 floating-point representations in JavaScript produce notorious rounding inaccuracies in financial applications:

```javascript
0.1 + 0.2 // => 0.30000000000000004
19.99 * 100 // => 1998.9999999999998
```

In institutional fee management handling tens of thousands of student records and millions of rupees, rounding drift can lead to phantom balances, unclosed invoices with balances like `₹0.0000001`, or accounting discrepancies during external audits.

---

## 2. Integer Paise Protocol

CampusSphere AI enforces the **Integer Paise Protocol** across all backend operations:
$$1\text{ Indian Rupee (INR)} = 100\text{ Paise}$$

### Implementation Rules
1. **Database Schema:**
   Every financial field is suffixed with `InPaise` and stored as an integer `Number`:
   - `grossAmountInPaise`
   - `concessionAmountInPaise`
   - `lateFeeAmountInPaise`
   - `netPayableInPaise`
   - `amountPaidInPaise`
   - `outstandingBalanceInPaise`

2. **Conversion Layer (`server/services/feeCalculation.service.js`):**
   ```javascript
   function toPaise(rupees) {
     if (rupees === null || rupees === undefined || isNaN(rupees)) return 0;
     return Math.round(Number(rupees) * 100);
   }

   function toRupees(paise) {
     if (!paise || isNaN(paise)) return 0;
     return paise / 100;
   }
   ```

3. **Mongoose Virtual Getters:**
   Virtual fields (`grossAmount`, `concessionAmount`, `lateFeeAmount`, `netPayable`, `amountPaid`, `outstandingBalance`) convert integer paise to standard rupee floats for UI consumption and JSON serialization.

4. **Zero Rounding Invariant:**
   All balance reconciliations, aggregations, additions, and subtractions are executed entirely in integer paise arithmetic before any division by 100.

