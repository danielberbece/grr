#!/usr/bin/env python
"""Functions for audit and logging."""



import logging
from logging import handlers
import os
import socket
import time

from grr.lib import config_lib
from grr.lib import flags

# Global Application Logger.
LOGGER = None


class GrrApplicationLogger(object):
  """The GRR application logger.

  These records are used for machine readable authentication logging of security
  critical events.
  """

  def WriteFrontendLogEntry(self, event_id, request, response):
    """Write a log entry for a Frontend or UI Request.

    Args:
      event_id: String generated by GetNewEventId.
      request: A HttpRequest protobuf.
      response: A HttpResponse protobuf.
    """
    log_msg = "%s-%s %d: %s %s %s %d %s" % (event_id, request.source_ip,
                                            response.code, request.method,
                                            request.url, request.user_agent,
                                            response.size, request.user)
    logging.info(log_msg)

  def GetNewEventId(self, event_time=None):
    """Return a unique Event ID string."""
    if event_time is None:
      event_time = long(time.time() * 1e6)

    return "%s:%s:%s" % (event_time, socket.gethostname(), os.getpid())


class PreLoggingMemoryHandler(handlers.BufferingHandler):
  """Handler used before logging subsystem is initialized."""

  def shouldFlush(self, record):
    return len(self.buffer) >= self.capacity

  def flush(self):
    """Flush the buffer.

    This is called when the buffer is really full, we just just drop one oldest
    message.
    """
    self.buffer = self.buffer[-self.capacity:]


class RobustSysLogHandler(handlers.SysLogHandler):
  """A handler which does not raise if it fails to connect."""

  def __init__(self, *args, **kwargs):
    self.formatter = None
    try:
      super(RobustSysLogHandler, self).__init__(*args, **kwargs)
    except socket.error:
      pass

  def handleError(self, record):
    """Just ignore socket errors - the syslog server might come back."""


BASE_LOG_LEVELS = {
    "FileHandler": logging.ERROR,
    "NTEventLogHandler": logging.CRITICAL,
    "StreamHandler": logging.ERROR,
    "RobustSysLogHandler": logging.CRITICAL,
}

VERBOSE_LOG_LEVELS = {
    "FileHandler": logging.DEBUG,
    "NTEventLogHandler": logging.INFO,
    "StreamHandler": logging.DEBUG,
    "RobustSysLogHandler": logging.INFO,
}


def SetLogLevels():
  logger = logging.getLogger()

  if config_lib.CONFIG["Logging.verbose"] or flags.FLAGS.verbose:
    levels = VERBOSE_LOG_LEVELS
  else:
    levels = BASE_LOG_LEVELS

  for handler in logger.handlers:
    handler.setLevel(levels[handler.__class__.__name__])


def GetLogHandlers():
  formatter = logging.Formatter(config_lib.CONFIG["Logging.format"])
  engines = config_lib.CONFIG["Logging.engines"]
  logging.debug("Will use logging engines %s", engines)

  for engine in engines:
    try:
      if engine == "stderr":
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        yield handler

      elif engine == "event_log":
        handler = handlers.NTEventLogHandler(config_lib.CONFIG[
            "Logging.service_name"])
        handler.setFormatter(formatter)
        yield handler

      elif engine == "syslog":
        # Allow the specification of UDP sockets.
        socket_name = config_lib.CONFIG["Logging.syslog_path"]
        if ":" in socket_name:
          addr, port = socket_name.split(":", 1)
          handler = RobustSysLogHandler((addr, int(port)))
        else:
          handler = RobustSysLogHandler(socket_name)

        handler.setFormatter(formatter)
        yield handler

      elif engine == "file":
        # Create a logfile if needed.
        path = config_lib.CONFIG["Logging.filename"]
        logging.info("Writing log file to %s", path)

        if not os.path.isdir(os.path.dirname(path)):
          os.makedirs(os.path.dirname(path))
        handler = logging.FileHandler(path, mode="ab")
        handler.setFormatter(formatter)
        yield handler

      else:
        logging.error("Unknown logging engine %s", engine)

    except Exception:  # pylint:disable=broad-except
      # Failure to log should not be fatal.
      logging.exception("Unable to create logger %s", engine)


def LogInit():
  """Configure the logging subsystem."""
  logging.debug("Initializing Logging subsystem.")

  if flags.FLAGS.verbose:
    # verbose flag just sets the logging verbosity level.
    config_lib.CONFIG.AddContext(
        "Debug Context",
        "This context is to allow verbose and debug output from "
        "the binary.")

  # The root logger.
  logger = logging.getLogger()
  memory_handlers = [m for m in logger.handlers
                     if m.__class__.__name__ == "PreLoggingMemoryHandler"]

  # Clear all handers.
  logger.handlers = list(GetLogHandlers())
  SetLogLevels()

  # Now flush the old messages into the log files.
  for handler in memory_handlers:
    for record in handler.buffer:
      logger.handle(record)


def AppLogInit():
  """Initialize the Application Log.

  This log is what will be used whenever someone does a log.LOGGER call. These
  are used for more detailed application or event logs.
  """
  logging.debug("Initializing Application Logger.")
  global LOGGER
  LOGGER = GrrApplicationLogger()

# There is a catch 22 here: We need to start logging right away but we will only
# configure the logging system once the config is read. Therefore we set up a
# memory logger now and then when the log destination is configured we replay
# the logs into that. This ensures we do not lose any log messages during early
# program start up.
root_logger = logging.root
root_logger.handlers = [PreLoggingMemoryHandler(1000)]
root_logger.setLevel(logging.DEBUG)
logging.info("Starting GRR Prelogging buffer.")
