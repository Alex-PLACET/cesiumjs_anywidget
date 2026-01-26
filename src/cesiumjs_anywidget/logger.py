"""Logging configuration for cesiumjs_anywidget package."""

import logging
import sys


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger instance.
    
    Parameters
    ----------
    name : str
        The name of the logger (typically __name__ from the calling module)
        
    Returns
    -------
    logging.Logger
        A configured logger instance
        
    Examples
    --------
    >>> from cesiumjs_anywidget.logger import get_logger
    >>> logger = get_logger(__name__)
    >>> logger.info("This is an info message")
    """
    logger = logging.getLogger(name)
    
    # Only configure if this logger hasn't been configured yet
    if not logger.handlers:
        # Set default level to INFO
        logger.setLevel(logging.INFO)
        
        # Create console handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.DEBUG)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(levelname)s - %(name)s - %(message)s'
        )
        handler.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(handler)
    
    return logger


def set_log_level(level: str | int):
    """Set the logging level for all cesiumjs_anywidget loggers.
    
    Parameters
    ----------
    level : str or int
        The logging level ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')
        or a logging constant (logging.DEBUG, logging.INFO, etc.)
        
    Examples
    --------
    >>> from cesiumjs_anywidget.logger import set_log_level
    >>> set_log_level('DEBUG')  # Show all messages
    >>> set_log_level('WARNING')  # Show only warnings and errors
    """
    if isinstance(level, str):
        level = getattr(logging, level.upper())
    
    # Set level for the base logger
    base_logger = logging.getLogger('cesiumjs_anywidget')
    base_logger.setLevel(level)
    
    # Update all child loggers
    for handler in base_logger.handlers:
        handler.setLevel(level)
