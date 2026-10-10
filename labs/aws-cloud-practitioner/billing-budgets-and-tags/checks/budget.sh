. "$LAB_LIB"
[ "$(sim '(b => b && b.BudgetLimit.Amount === "100" && b.TimeUnit === "MONTHLY" ? "yes" : "no")(s.budgets["monthly-limit"])')" = yes ] || fail "Create the monthly-limit budget with an amount of 100."
