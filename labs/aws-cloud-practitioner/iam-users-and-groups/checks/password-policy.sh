. "$LAB_LIB"
[ "$(sim '(p => p && p.MinimumPasswordLength >= 12 && p.RequireSymbols && p.RequireNumbers ? "yes" : "no")(s.iam.passwordPolicy)')" = yes ] || fail "The password policy needs length 12+, symbols and numbers."
