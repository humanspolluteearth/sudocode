for mark in [95, 72, 55, 30]:
    if mark >= 90:
        grade = "A"
    elif mark >= 70:
        grade = "B"
    elif mark >= 50:
        grade = "C"
    else:
        grade = "U"
    print(mark, grade)
