class InsufficientFunds(Exception):
    def __init__(self, needed, available):
        super().__init__("need " + str(needed) + " but only " + str(available))
        self.needed = needed
        self.available = available


class AppError(Exception):
    pass


class BadInput(AppError):
    pass


def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFunds(amount, balance)
    return balance - amount


try:
    withdraw(10, 50)
except InsufficientFunds as e:
    print(e, e.needed, e.available)
try:
    raise BadInput("oops")
except AppError as e:
    print("AppError caught:", e, type(e).__name__)
try:
    raise AppError
except Exception as e:
    print(repr(e), str(e) == "")
try:
    raise BadInput("a", "b")
except BadInput as e:
    print(e.args, e)
print(isinstance(BadInput("x"), AppError), issubclass(BadInput, Exception))
try:
    try:
        raise BadInput("inner")
    except ValueError:
        print("wrong handler")
    finally:
        print("cleanup")
except AppError as e:
    print("outer", e)
withdraw(1, 2)
