# Grade checker
name = input("Name: ")
mark = int(input("Mark: "))

if mark >= 70:
    grade = "A"
elif mark >= 50:
    grade = "B"
else:
    grade = "C"

print(f"{name} got grade {grade}")
