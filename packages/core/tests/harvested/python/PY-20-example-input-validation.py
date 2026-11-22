# Keep asking until the input is a valid age
while True:
    try:
        age = int(input("Age: "))
    except ValueError:
        print("Please type a whole number")
        continue
    if 0 <= age <= 120:
        break
    print("Out of range, try again")

print("Age accepted:", age)
