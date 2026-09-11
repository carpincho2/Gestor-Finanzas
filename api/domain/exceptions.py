class DomainException(Exception):
    """Excepción base del dominio."""
    pass

class UserNotFoundException(DomainException):
    pass

class InvalidCredentialsException(DomainException):
    pass

class ProductNotFoundException(DomainException):
    pass

class AccountNotFoundException(DomainException):
    pass
