# Times table
number = int(input("Which table? "))

for count in range(1, 13):
    print(count, "x", number, "=", count * number)
