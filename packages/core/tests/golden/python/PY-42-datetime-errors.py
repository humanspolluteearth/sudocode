from datetime import date, timedelta
for args in [(2024, 13, 1), (2023, 2, 29), (2024, 4, 31), (0, 1, 1)]:
    try:
        date(args[0], args[1], args[2])
    except ValueError as e:
        print("ValueError:", e)
try:
    date(2024, 1, 1) + date(2024, 1, 2)
except TypeError as e:
    print("TypeError:", e)
try:
    date(2024, 1, 1) + 5
except TypeError as e:
    print("TypeError:", e)
print(date(9999, 12, 31) + timedelta(days=1))
