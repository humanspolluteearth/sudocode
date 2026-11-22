# Guess the number from 1 to 10
import random

secret = random.randint(1, 10)
guesses = 0
guess = 0

while guess != secret:
    guess = int(input("Guess: "))
    guesses += 1
    if guess < secret:
        print("Too low")
    elif guess > secret:
        print("Too high")

print("Correct in", guesses, "guesses")
